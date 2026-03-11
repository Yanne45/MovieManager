use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_collections(state: State<'_, AppState>) -> Result<Vec<CollectionWithCount>, String> {
    queries::get_collections_with_counts(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_collection(
    state: State<'_, AppState>,
    name: String, description: Option<String>,
) -> Result<Collection, String> {
    queries::create_collection(state.db().pool(), &name, description.as_deref())
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_collection(
    state: State<'_, AppState>,
    id: i64, name: Option<String>, description: Option<String>,
) -> Result<Option<Collection>, String> {
    queries::update_collection(state.db().pool(), id, name.as_deref(), description.as_deref())
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_collection(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    queries::delete_collection(state.db().pool(), id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_collection_items(state: State<'_, AppState>, collection_id: i64) -> Result<Vec<CollectionItemRow>, String> {
    queries::get_collection_items(state.db().pool(), collection_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_collection_item(
    state: State<'_, AppState>,
    collection_id: i64, movie_id: Option<i64>, series_id: Option<i64>,
) -> Result<(), String> {
    queries::add_collection_item(state.db().pool(), collection_id, movie_id, series_id)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_collection_item(state: State<'_, AppState>, item_id: i64) -> Result<bool, String> {
    queries::remove_collection_item(state.db().pool(), item_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reorder_collection_item(state: State<'_, AppState>, item_id: i64, new_position: i64) -> Result<(), String> {
    queries::reorder_collection_item(state.db().pool(), item_id, new_position)
        .await.map_err(|e| e.to_string())
}

// ============================================================================
// Smart collections
// ============================================================================

#[tauri::command]
pub async fn create_smart_collection(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
    smart_rules: String,
) -> Result<Collection, String> {
    // Validate JSON rules
    serde_json::from_str::<SmartRuleSet>(&smart_rules)
        .map_err(|e| format!("Invalid smart rules JSON: {}", e))?;
    queries::create_smart_collection(state.db().pool(), &name, description.as_deref(), &smart_rules)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_smart_rules(
    state: State<'_, AppState>,
    id: i64,
    smart_rules: String,
) -> Result<Option<Collection>, String> {
    serde_json::from_str::<SmartRuleSet>(&smart_rules)
        .map_err(|e| format!("Invalid smart rules JSON: {}", e))?;
    queries::update_smart_rules(state.db().pool(), id, &smart_rules)
        .await.map_err(|e| e.to_string())
}

/// Evaluate smart collection rules and return matching items
#[tauri::command]
pub async fn get_smart_collection_items(
    state: State<'_, AppState>,
    collection_id: i64,
) -> Result<Vec<SmartCollectionResult>, String> {
    let db = state.db();
    let pool = db.pool();

    // Fetch the collection to get rules
    let col: Collection = sqlx::query_as(
        "SELECT * FROM collections WHERE id = ? AND is_smart = 1"
    )
    .bind(collection_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Collection dynamique {} introuvable", collection_id))?;

    let rules_json = col.smart_rules.ok_or("Aucune règle dynamique définie")?;
    let ruleset: SmartRuleSet = serde_json::from_str(&rules_json)
        .map_err(|e| format!("Invalid rules: {}", e))?;

    let mut results: Vec<SmartCollectionResult> = Vec::new();

    // Build movie query
    if ruleset.entity_type != Some("series".into()) {
        let (where_clause, binds) = build_movie_where(&ruleset);
        let sql = format!(
            "SELECT DISTINCT m.id, m.title, m.year, m.poster_path, 'movie' AS entity_type
             FROM movies m {} WHERE 1=1 {}
             ORDER BY m.title",
            build_movie_joins(&ruleset),
            where_clause
        );
        let mut query = sqlx::query_as::<_, SmartCollectionResult>(&sql);
        for bind in &binds {
            query = query.bind(bind.clone());
        }
        let movies = query.fetch_all(pool).await.map_err(|e| e.to_string())?;
        results.extend(movies);
    }

    // Build series query
    if ruleset.entity_type != Some("movie".into()) {
        let (where_clause, binds) = build_series_where(&ruleset);
        let sql = format!(
            "SELECT DISTINCT s.id, s.title,
                    CAST(SUBSTR(s.first_air_date, 1, 4) AS INTEGER) AS year,
                    s.poster_path, 'series' AS entity_type
             FROM series s {} WHERE 1=1 {}
             ORDER BY s.title",
            build_series_joins(&ruleset),
            where_clause
        );
        let mut query = sqlx::query_as::<_, SmartCollectionResult>(&sql);
        for bind in &binds {
            query = query.bind(bind.clone());
        }
        let series = query.fetch_all(pool).await.map_err(|e| e.to_string())?;
        results.extend(series);
    }

    Ok(results)
}

// ---- Smart collection types ----

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SmartRuleSet {
    #[serde(rename = "match", default = "default_match")]
    pub match_mode: String, // "all" or "any"
    pub rules: Vec<SmartRule>,
    pub entity_type: Option<String>, // "movie", "series", or None (both)
}

fn default_match() -> String { "all".to_string() }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SmartRule {
    pub field: String,  // "year", "tag", "genre", "score", "owned", "content_rating"
    pub op: String,     // "eq", "neq", "gt", "gte", "lt", "lte", "has", "not_has", "contains"
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct SmartCollectionResult {
    pub id: i64,
    pub title: String,
    pub year: Option<i64>,
    pub poster_path: Option<String>,
    pub entity_type: String,
}

// ---- SQL builder helpers ----

fn sql_op(op: &str) -> &str {
    match op {
        "eq" => "=",
        "neq" => "!=",
        "gt" => ">",
        "gte" => ">=",
        "lt" => "<",
        "lte" => "<=",
        _ => "=",
    }
}

fn build_movie_joins(ruleset: &SmartRuleSet) -> String {
    let mut joins = Vec::new();
    let needs_tag = ruleset.rules.iter().any(|r| r.field == "tag");
    let needs_genre = ruleset.rules.iter().any(|r| r.field == "genre");
    if needs_tag {
        joins.push("LEFT JOIN movie_tags mt ON m.id = mt.movie_id");
    }
    if needs_genre {
        joins.push("LEFT JOIN movie_genres mg ON m.id = mg.movie_id");
    }
    joins.join(" ")
}

fn build_series_joins(ruleset: &SmartRuleSet) -> String {
    let mut joins = Vec::new();
    let needs_tag = ruleset.rules.iter().any(|r| r.field == "tag");
    let needs_genre = ruleset.rules.iter().any(|r| r.field == "genre");
    if needs_tag {
        joins.push("LEFT JOIN series_tags st ON s.id = st.series_id");
    }
    if needs_genre {
        joins.push("LEFT JOIN series_genres sg ON s.id = sg.series_id");
    }
    joins.join(" ")
}

fn build_movie_where(ruleset: &SmartRuleSet) -> (String, Vec<String>) {
    let connector = if ruleset.match_mode == "any" { " OR " } else { " AND " };
    let mut clauses = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    for rule in &ruleset.rules {
        match rule.field.as_str() {
            "year" => {
                if let Some(v) = rule.value.as_i64() {
                    clauses.push(format!("m.year {} ?", sql_op(&rule.op)));
                    binds.push(v.to_string());
                }
            }
            "score" => {
                if let Some(v) = rule.value.as_str() {
                    clauses.push(format!("m.primary_quality_score {} ?", sql_op(&rule.op)));
                    binds.push(v.to_string());
                }
            }
            "owned" => {
                let v = if rule.value.as_bool().unwrap_or(true) { "1" } else { "0" };
                clauses.push(format!("m.owned = {}", v));
            }
            "content_rating" => {
                if let Some(v) = rule.value.as_str() {
                    clauses.push(format!("m.content_rating {} ?", sql_op(&rule.op)));
                    binds.push(v.to_string());
                }
            }
            "tag" => {
                if let Some(v) = rule.value.as_i64() {
                    if rule.op == "not_has" {
                        clauses.push(format!(
                            "m.id NOT IN (SELECT movie_id FROM movie_tags WHERE tag_id = ?)"
                        ));
                    } else {
                        clauses.push("mt.tag_id = ?".to_string());
                    }
                    binds.push(v.to_string());
                }
            }
            "genre" => {
                if let Some(v) = rule.value.as_i64() {
                    if rule.op == "not_has" {
                        clauses.push(format!(
                            "m.id NOT IN (SELECT movie_id FROM movie_genres WHERE genre_id = ?)"
                        ));
                    } else {
                        clauses.push("mg.genre_id = ?".to_string());
                    }
                    binds.push(v.to_string());
                }
            }
            "title" => {
                if let Some(v) = rule.value.as_str() {
                    clauses.push("m.title LIKE ?".to_string());
                    binds.push(format!("%{}%", v));
                }
            }
            _ => {}
        }
    }

    if clauses.is_empty() {
        return (String::new(), binds);
    }
    (format!(" AND ({})", clauses.join(connector)), binds)
}

fn build_series_where(ruleset: &SmartRuleSet) -> (String, Vec<String>) {
    let connector = if ruleset.match_mode == "any" { " OR " } else { " AND " };
    let mut clauses = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    for rule in &ruleset.rules {
        match rule.field.as_str() {
            "year" => {
                if let Some(v) = rule.value.as_i64() {
                    clauses.push(format!("CAST(SUBSTR(s.first_air_date, 1, 4) AS INTEGER) {} ?", sql_op(&rule.op)));
                    binds.push(v.to_string());
                }
            }
            "owned" => {
                let v = if rule.value.as_bool().unwrap_or(true) { "1" } else { "0" };
                clauses.push(format!("s.owned = {}", v));
            }
            "content_rating" => {
                if let Some(v) = rule.value.as_str() {
                    clauses.push(format!("s.content_rating {} ?", sql_op(&rule.op)));
                    binds.push(v.to_string());
                }
            }
            "status" => {
                if let Some(v) = rule.value.as_str() {
                    clauses.push(format!("s.status {} ?", sql_op(&rule.op)));
                    binds.push(v.to_string());
                }
            }
            "tag" => {
                if let Some(v) = rule.value.as_i64() {
                    if rule.op == "not_has" {
                        clauses.push(format!(
                            "s.id NOT IN (SELECT series_id FROM series_tags WHERE tag_id = ?)"
                        ));
                    } else {
                        clauses.push("st.tag_id = ?".to_string());
                    }
                    binds.push(v.to_string());
                }
            }
            "genre" => {
                if let Some(v) = rule.value.as_i64() {
                    if rule.op == "not_has" {
                        clauses.push(format!(
                            "s.id NOT IN (SELECT series_id FROM series_genres WHERE genre_id = ?)"
                        ));
                    } else {
                        clauses.push("sg.genre_id = ?".to_string());
                    }
                    binds.push(v.to_string());
                }
            }
            "title" => {
                if let Some(v) = rule.value.as_str() {
                    clauses.push("s.title LIKE ?".to_string());
                    binds.push(format!("%{}%", v));
                }
            }
            _ => {}
        }
    }

    if clauses.is_empty() {
        return (String::new(), binds);
    }
    (format!(" AND ({})", clauses.join(connector)), binds)
}
