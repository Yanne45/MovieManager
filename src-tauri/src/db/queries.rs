use anyhow::Result;
use sqlx::SqlitePool;

use super::models::*;

// ============================================================================
// Libraries
// ============================================================================

pub async fn get_libraries(pool: &SqlitePool) -> Result<Vec<Library>> {
    let rows = sqlx::query_as::<_, Library>("SELECT * FROM libraries ORDER BY name")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn get_library(pool: &SqlitePool, id: i64) -> Result<Option<Library>> {
    let row = sqlx::query_as::<_, Library>("SELECT * FROM libraries WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create_library(pool: &SqlitePool, input: &CreateLibrary) -> Result<Library> {
    let row = sqlx::query_as::<_, Library>(
        "INSERT INTO libraries (name, path, type, notes, volume_label)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *"
    )
    .bind(&input.name)
    .bind(&input.path)
    .bind(&input.lib_type)
    .bind(&input.notes)
    .bind(&input.volume_label)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn update_library(pool: &SqlitePool, id: i64, input: &UpdateLibrary) -> Result<Option<Library>> {
    let existing = get_library(pool, id).await?;
    let Some(existing) = existing else { return Ok(None) };

    let name = input.name.as_deref().unwrap_or(&existing.name);
    let path = input.path.as_deref().unwrap_or(&existing.path);
    let lib_type = input.lib_type.as_deref().unwrap_or(&existing.lib_type);
    let is_online = input.is_online.unwrap_or(existing.is_online);
    let notes = input.notes.as_deref().or(existing.notes.as_deref());
    let volume_label = input.volume_label.as_deref().or(existing.volume_label.as_deref());

    let row = sqlx::query_as::<_, Library>(
        "UPDATE libraries SET name = ?, path = ?, type = ?, is_online = ?, notes = ?,
         volume_label = ?, updated_at = datetime('now')
         WHERE id = ? RETURNING *"
    )
    .bind(name)
    .bind(path)
    .bind(lib_type)
    .bind(is_online)
    .bind(notes)
    .bind(volume_label)
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn delete_library(pool: &SqlitePool, id: i64) -> Result<bool> {
    let result = sqlx::query("DELETE FROM libraries WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ============================================================================
// Movies
// ============================================================================

pub async fn get_movies(pool: &SqlitePool) -> Result<Vec<Movie>> {
    let rows = sqlx::query_as::<_, Movie>(
        "SELECT * FROM movies ORDER BY sort_title, title"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_movie_file_locations(pool: &SqlitePool) -> Result<Vec<MovieFileLocation>> {
    Ok(sqlx::query_as::<_, MovieFileLocation>(
        "SELECT mv.owner_id AS movie_id,
                l.volume_label,
                mf.file_path,
                mf.file_name,
                l.name AS library_name
         FROM media_versions mv
         JOIN media_files mf ON mf.media_version_id = mv.id
         JOIN libraries l ON l.id = mf.library_id
         WHERE mv.owner_type = 'movie'
         GROUP BY mv.owner_id
         ORDER BY mv.owner_id"
    )
    .fetch_all(pool).await?)
}

pub async fn get_movie_file_sizes(pool: &SqlitePool) -> Result<Vec<(i64, i64)>> {
    let rows = sqlx::query_as::<_, (i64, i64)>(
        "SELECT mv.owner_id AS movie_id, COALESCE(SUM(mf.file_size), 0) AS total_size
         FROM media_versions mv
         JOIN media_files mf ON mf.media_version_id = mv.id
         WHERE mv.owner_type = 'movie'
         GROUP BY mv.owner_id"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_movie(pool: &SqlitePool, id: i64) -> Result<Option<Movie>> {
    let row = sqlx::query_as::<_, Movie>("SELECT * FROM movies WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create_movie(pool: &SqlitePool, input: &CreateMovie) -> Result<Movie> {
    let owned = input.owned.unwrap_or(true);
    let row = sqlx::query_as::<_, Movie>(
        "INSERT INTO movies (title, original_title, year, runtime, overview, owned, tmdb_id, imdb_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *"
    )
    .bind(&input.title)
    .bind(&input.original_title)
    .bind(input.year)
    .bind(input.runtime)
    .bind(&input.overview)
    .bind(owned)
    .bind(input.tmdb_id)
    .bind(&input.imdb_id)
    .bind(&input.notes)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn update_movie(pool: &SqlitePool, id: i64, input: &UpdateMovie) -> Result<Option<Movie>> {
    let existing = get_movie(pool, id).await?;
    let Some(ex) = existing else { return Ok(None) };

    let row = sqlx::query_as::<_, Movie>(
        "UPDATE movies SET
            title = ?, original_title = ?, sort_title = ?, overview = ?,
            year = ?, runtime = ?, content_rating = ?, tagline = ?,
            poster_path = ?, backdrop_path = ?, owned = ?,
            tmdb_id = ?, imdb_id = ?, primary_quality_score = ?, notes = ?,
            updated_at = datetime('now')
         WHERE id = ? RETURNING *"
    )
    .bind(input.title.as_deref().unwrap_or(&ex.title))
    .bind(input.original_title.as_deref().or(ex.original_title.as_deref()))
    .bind(input.sort_title.as_deref().or(ex.sort_title.as_deref()))
    .bind(input.overview.as_deref().or(ex.overview.as_deref()))
    .bind(input.year.or(ex.year))
    .bind(input.runtime.or(ex.runtime))
    .bind(input.content_rating.as_deref().or(ex.content_rating.as_deref()))
    .bind(input.tagline.as_deref().or(ex.tagline.as_deref()))
    .bind(input.poster_path.as_deref().or(ex.poster_path.as_deref()))
    .bind(input.backdrop_path.as_deref().or(ex.backdrop_path.as_deref()))
    .bind(input.owned.unwrap_or(ex.owned))
    .bind(input.tmdb_id.or(ex.tmdb_id))
    .bind(input.imdb_id.as_deref().or(ex.imdb_id.as_deref()))
    .bind(input.primary_quality_score.as_deref().or(ex.primary_quality_score.as_deref()))
    .bind(input.notes.as_deref().or(ex.notes.as_deref()))
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn delete_movie(pool: &SqlitePool, id: i64) -> Result<bool> {
    let result = sqlx::query("DELETE FROM movies WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Find movie by TMDB ID (for duplicate detection during import)
pub async fn find_movie_by_tmdb(pool: &SqlitePool, tmdb_id: i64) -> Result<Option<Movie>> {
    let row = sqlx::query_as::<_, Movie>("SELECT * FROM movies WHERE tmdb_id = ?")
        .bind(tmdb_id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

// ============================================================================
// Series
// ============================================================================

pub async fn get_series_list(pool: &SqlitePool) -> Result<Vec<Series>> {
    let rows = sqlx::query_as::<_, Series>(
        "SELECT * FROM series ORDER BY sort_title, title"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_series(pool: &SqlitePool, id: i64) -> Result<Option<Series>> {
    let row = sqlx::query_as::<_, Series>("SELECT * FROM series WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn get_seasons(pool: &SqlitePool, series_id: i64) -> Result<Vec<Season>> {
    let rows = sqlx::query_as::<_, Season>(
        "SELECT * FROM seasons WHERE series_id = ? ORDER BY season_number"
    )
    .bind(series_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_episodes(pool: &SqlitePool, season_id: i64) -> Result<Vec<Episode>> {
    let rows = sqlx::query_as::<_, Episode>(
        "SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number"
    )
    .bind(season_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Get completeness stats for a series
pub async fn get_series_completeness(pool: &SqlitePool, series_id: i64) -> Result<(i64, i64)> {
    let row: (i64, i64) = sqlx::query_as(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN has_file = 1 THEN 1 ELSE 0 END) as owned
         FROM episodes WHERE series_id = ?"
    )
    .bind(series_id)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

// ============================================================================
// Tags
// ============================================================================

pub async fn get_tags(pool: &SqlitePool) -> Result<Vec<TagWithUsageCount>> {
    let rows = sqlx::query_as::<_, TagWithUsageCount>(
        "SELECT
            t.id, t.name, t.color, t.auto_generated, t.created_at,
            COALESCE(COUNT(mt.movie_id), 0) AS usage_count
         FROM tags t
         LEFT JOIN movie_tags mt ON mt.tag_id = t.id
         GROUP BY t.id
         ORDER BY t.name"
    )
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn create_tag(pool: &SqlitePool, name: &str, color: Option<&str>, auto_generated: bool) -> Result<Tag> {
    let row = sqlx::query_as::<_, Tag>(
        "INSERT INTO tags (name, color, auto_generated) VALUES (?, ?, ?) RETURNING *"
    )
    .bind(name)
    .bind(color)
    .bind(auto_generated)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn delete_tag(pool: &SqlitePool, id: i64) -> Result<bool> {
    let result = sqlx::query("DELETE FROM tags WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Link a tag to a movie
pub async fn add_movie_tag(pool: &SqlitePool, movie_id: i64, tag_id: i64) -> Result<()> {
    sqlx::query("INSERT OR IGNORE INTO movie_tags (movie_id, tag_id) VALUES (?, ?)")
        .bind(movie_id)
        .bind(tag_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Get tags for a movie
pub async fn get_movie_tags(pool: &SqlitePool, movie_id: i64) -> Result<Vec<Tag>> {
    let rows = sqlx::query_as::<_, Tag>(
        "SELECT t.* FROM tags t
         INNER JOIN movie_tags mt ON mt.tag_id = t.id
         WHERE mt.movie_id = ?
         ORDER BY t.name"
    )
    .bind(movie_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// ============================================================================
// Media versions & files
// ============================================================================

pub async fn create_media_version(
    pool: &SqlitePool,
    owner_type: &str,
    owner_id: i64,
    label: Option<&str>,
) -> Result<MediaVersion> {
    let row = sqlx::query_as::<_, MediaVersion>(
        "INSERT INTO media_versions (owner_type, owner_id, label) VALUES (?, ?, ?) RETURNING *"
    )
    .bind(owner_type)
    .bind(owner_id)
    .bind(label)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn create_media_file(
    pool: &SqlitePool,
    media_version_id: i64,
    library_id: i64,
    file_path: &str,
    file_name: &str,
    file_size: Option<i64>,
) -> Result<MediaFile> {
    let row = sqlx::query_as::<_, MediaFile>(
        "INSERT INTO media_files (media_version_id, library_id, file_path, file_name, file_size)
         VALUES (?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(media_version_id)
    .bind(library_id)
    .bind(file_path)
    .bind(file_name)
    .bind(file_size)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn get_movie_versions(pool: &SqlitePool, movie_id: i64) -> Result<Vec<MediaVersion>> {
    let rows = sqlx::query_as::<_, MediaVersion>(
        "SELECT * FROM media_versions WHERE owner_type = 'movie' AND owner_id = ?"
    )
    .bind(movie_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_version_files(pool: &SqlitePool, version_id: i64) -> Result<Vec<MediaFile>> {
    let rows = sqlx::query_as::<_, MediaFile>(
        "SELECT * FROM media_files WHERE media_version_id = ?"
    )
    .bind(version_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// ============================================================================
// Series CRUD
// ============================================================================

pub async fn update_series(pool: &SqlitePool, id: i64, input: &UpdateSeries) -> Result<Option<Series>> {
    let mut sets: Vec<String> = Vec::new();

    macro_rules! push_if_some {
        ($field:ident, $col:expr) => {
            if input.$field.is_some() { sets.push(format!("{} = ?", $col)); }
        };
    }
    push_if_some!(title, "title");
    push_if_some!(original_title, "original_title");
    push_if_some!(sort_title, "sort_title");
    push_if_some!(overview, "overview");
    push_if_some!(first_air_date, "first_air_date");
    push_if_some!(last_air_date, "last_air_date");
    push_if_some!(status, "status");
    push_if_some!(total_seasons, "total_seasons");
    push_if_some!(total_episodes, "total_episodes");
    push_if_some!(content_rating, "content_rating");
    push_if_some!(poster_path, "poster_path");
    push_if_some!(backdrop_path, "backdrop_path");
    push_if_some!(owned, "owned");
    push_if_some!(tmdb_id, "tmdb_id");
    push_if_some!(imdb_id, "imdb_id");
    push_if_some!(tvdb_id, "tvdb_id");
    push_if_some!(notes, "notes");

    if sets.is_empty() {
        return Ok(sqlx::query_as::<_, Series>("SELECT * FROM series WHERE id = ?")
            .bind(id).fetch_optional(pool).await?);
    }

    sets.push("updated_at = datetime('now')".to_string());
    let query = format!("UPDATE series SET {} WHERE id = ? RETURNING *", sets.join(", "));

    let mut q = sqlx::query_as::<_, Series>(&query);

    macro_rules! bind_if_some {
        ($field:ident) => {
            if let Some(ref v) = input.$field { q = q.bind(v); }
        };
    }
    bind_if_some!(title);
    bind_if_some!(original_title);
    bind_if_some!(sort_title);
    bind_if_some!(overview);
    bind_if_some!(first_air_date);
    bind_if_some!(last_air_date);
    bind_if_some!(status);
    bind_if_some!(total_seasons);
    bind_if_some!(total_episodes);
    bind_if_some!(content_rating);
    bind_if_some!(poster_path);
    bind_if_some!(backdrop_path);
    bind_if_some!(owned);
    bind_if_some!(tmdb_id);
    bind_if_some!(imdb_id);
    bind_if_some!(tvdb_id);
    bind_if_some!(notes);
    q = q.bind(id);

    Ok(q.fetch_optional(pool).await?)
}

// ============================================================================
// People CRUD
// ============================================================================

pub async fn get_people(pool: &SqlitePool) -> Result<Vec<Person>> {
    Ok(sqlx::query_as::<_, Person>("SELECT * FROM people ORDER BY name")
        .fetch_all(pool).await?)
}

pub async fn get_person(pool: &SqlitePool, id: i64) -> Result<Option<Person>> {
    Ok(sqlx::query_as::<_, Person>("SELECT * FROM people WHERE id = ?")
        .bind(id).fetch_optional(pool).await?)
}

pub async fn create_person(pool: &SqlitePool, name: &str, primary_role: Option<&str>, tmdb_id: Option<i64>) -> Result<Person> {
    Ok(sqlx::query_as::<_, Person>(
        "INSERT INTO people (name, primary_role, tmdb_id) VALUES (?, ?, ?) RETURNING *"
    )
    .bind(name).bind(primary_role).bind(tmdb_id)
    .fetch_one(pool).await?)
}

pub async fn update_person(pool: &SqlitePool, id: i64, name: Option<&str>, primary_role: Option<&str>, biography: Option<&str>, notes: Option<&str>) -> Result<Option<Person>> {
    let mut sets = Vec::new();
    if name.is_some() { sets.push("name = ?"); }
    if primary_role.is_some() { sets.push("primary_role = ?"); }
    if biography.is_some() { sets.push("biography = ?"); }
    if notes.is_some() { sets.push("notes = ?"); }
    if sets.is_empty() {
        return Ok(sqlx::query_as::<_, Person>("SELECT * FROM people WHERE id = ?")
            .bind(id).fetch_optional(pool).await?);
    }
    sets.push("updated_at = datetime('now')");
    let sql = format!("UPDATE people SET {} WHERE id = ? RETURNING *", sets.join(", "));
    let mut q = sqlx::query_as::<_, Person>(&sql);
    if let Some(v) = name { q = q.bind(v); }
    if let Some(v) = primary_role { q = q.bind(v); }
    if let Some(v) = biography { q = q.bind(v); }
    if let Some(v) = notes { q = q.bind(v); }
    q = q.bind(id);
    Ok(q.fetch_optional(pool).await?)
}

pub async fn delete_person(pool: &SqlitePool, id: i64) -> Result<bool> {
    let r = sqlx::query("DELETE FROM people WHERE id = ?").bind(id).execute(pool).await?;
    Ok(r.rows_affected() > 0)
}

/// Get people linked to a movie, with role and character info
pub async fn get_movie_people(pool: &SqlitePool, movie_id: i64) -> Result<Vec<MoviePersonRow>> {
    Ok(sqlx::query_as::<_, MoviePersonRow>(
        "SELECT p.id AS person_id, p.name, p.primary_role, p.photo_path, p.tmdb_id,
                mp.role, mp.character_name, mp.credit_order
         FROM people p JOIN movie_people mp ON p.id = mp.person_id
         WHERE mp.movie_id = ? ORDER BY mp.credit_order"
    )
    .bind(movie_id)
    .fetch_all(pool)
    .await?)
}

/// Link a person to a movie
pub async fn add_movie_person(pool: &SqlitePool, movie_id: i64, person_id: i64, role: &str, character_name: Option<&str>, credit_order: Option<i64>) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO movie_people (movie_id, person_id, role, character_name, credit_order)
         VALUES (?, ?, ?, ?, ?)"
    )
    .bind(movie_id).bind(person_id).bind(role).bind(character_name).bind(credit_order)
    .execute(pool).await?;
    Ok(())
}

pub async fn remove_movie_person(pool: &SqlitePool, movie_id: i64, person_id: i64, role: &str) -> Result<()> {
    sqlx::query("DELETE FROM movie_people WHERE movie_id = ? AND person_id = ? AND role = ?")
        .bind(movie_id).bind(person_id).bind(role)
        .execute(pool).await?;
    Ok(())
}

/// Get movies linked to a person (reverse lookup for filmography)
pub async fn get_person_movies(pool: &SqlitePool, person_id: i64) -> Result<Vec<PersonMovieRow>> {
    Ok(sqlx::query_as::<_, PersonMovieRow>(
        "SELECT m.id AS movie_id, m.title, m.year, m.poster_path,
                mp.role, mp.character_name
         FROM movies m JOIN movie_people mp ON m.id = mp.movie_id
         WHERE mp.person_id = ? ORDER BY m.year DESC, m.title"
    )
    .bind(person_id)
    .fetch_all(pool)
    .await?)
}

// ============================================================================
// Studios CRUD
// ============================================================================

pub async fn get_studios(pool: &SqlitePool) -> Result<Vec<Studio>> {
    Ok(sqlx::query_as::<_, Studio>("SELECT * FROM studios ORDER BY name")
        .fetch_all(pool).await?)
}

pub async fn get_studio(pool: &SqlitePool, id: i64) -> Result<Option<Studio>> {
    Ok(sqlx::query_as::<_, Studio>("SELECT * FROM studios WHERE id = ?")
        .bind(id).fetch_optional(pool).await?)
}

pub async fn create_studio(pool: &SqlitePool, name: &str, country: Option<&str>, tmdb_id: Option<i64>) -> Result<Studio> {
    Ok(sqlx::query_as::<_, Studio>(
        "INSERT INTO studios (name, country, tmdb_id) VALUES (?, ?, ?) RETURNING *"
    )
    .bind(name).bind(country).bind(tmdb_id)
    .fetch_one(pool).await?)
}

pub async fn update_studio(pool: &SqlitePool, id: i64, name: Option<&str>, country: Option<&str>, description: Option<&str>, notes: Option<&str>) -> Result<Option<Studio>> {
    let mut sets = Vec::new();
    if name.is_some() { sets.push("name = ?"); }
    if country.is_some() { sets.push("country = ?"); }
    if description.is_some() { sets.push("description = ?"); }
    if notes.is_some() { sets.push("notes = ?"); }
    if sets.is_empty() {
        return Ok(sqlx::query_as::<_, Studio>("SELECT * FROM studios WHERE id = ?")
            .bind(id).fetch_optional(pool).await?);
    }
    sets.push("updated_at = datetime('now')");
    let sql = format!("UPDATE studios SET {} WHERE id = ? RETURNING *", sets.join(", "));
    let mut q = sqlx::query_as::<_, Studio>(&sql);
    if let Some(v) = name { q = q.bind(v); }
    if let Some(v) = country { q = q.bind(v); }
    if let Some(v) = description { q = q.bind(v); }
    if let Some(v) = notes { q = q.bind(v); }
    q = q.bind(id);
    Ok(q.fetch_optional(pool).await?)
}

pub async fn delete_studio(pool: &SqlitePool, id: i64) -> Result<bool> {
    let r = sqlx::query("DELETE FROM studios WHERE id = ?").bind(id).execute(pool).await?;
    Ok(r.rows_affected() > 0)
}

pub async fn add_movie_studio(pool: &SqlitePool, movie_id: i64, studio_id: i64) -> Result<()> {
    sqlx::query("INSERT OR IGNORE INTO movie_studios (movie_id, studio_id) VALUES (?, ?)")
        .bind(movie_id).bind(studio_id).execute(pool).await?;
    Ok(())
}

pub async fn remove_movie_studio(pool: &SqlitePool, movie_id: i64, studio_id: i64) -> Result<()> {
    sqlx::query("DELETE FROM movie_studios WHERE movie_id = ? AND studio_id = ?")
        .bind(movie_id).bind(studio_id).execute(pool).await?;
    Ok(())
}

/// Get movies linked to a studio (reverse lookup)
pub async fn get_studio_movies(pool: &SqlitePool, studio_id: i64) -> Result<Vec<StudioMovieRow>> {
    Ok(sqlx::query_as::<_, StudioMovieRow>(
        "SELECT m.id AS movie_id, m.title, m.year, m.poster_path
         FROM movies m JOIN movie_studios ms ON m.id = ms.movie_id
         WHERE ms.studio_id = ? ORDER BY m.year DESC, m.title"
    )
    .bind(studio_id)
    .fetch_all(pool)
    .await?)
}

// ============================================================================
// Collections CRUD
// ============================================================================

pub async fn get_collections(pool: &SqlitePool) -> Result<Vec<Collection>> {
    Ok(sqlx::query_as::<_, Collection>("SELECT * FROM collections ORDER BY name")
        .fetch_all(pool).await?)
}

pub async fn create_collection(pool: &SqlitePool, name: &str, description: Option<&str>) -> Result<Collection> {
    Ok(sqlx::query_as::<_, Collection>(
        "INSERT INTO collections (name, description) VALUES (?, ?) RETURNING *"
    )
    .bind(name).bind(description)
    .fetch_one(pool).await?)
}

pub async fn update_collection(pool: &SqlitePool, id: i64, name: Option<&str>, description: Option<&str>) -> Result<Option<Collection>> {
    let mut sets = Vec::new();
    if name.is_some() { sets.push("name = ?"); }
    if description.is_some() { sets.push("description = ?"); }
    if sets.is_empty() {
        return Ok(sqlx::query_as::<_, Collection>("SELECT * FROM collections WHERE id = ?")
            .bind(id).fetch_optional(pool).await?);
    }
    sets.push("updated_at = datetime('now')");
    let sql = format!("UPDATE collections SET {} WHERE id = ? RETURNING *", sets.join(", "));
    let mut q = sqlx::query_as::<_, Collection>(&sql);
    if let Some(v) = name { q = q.bind(v); }
    if let Some(v) = description { q = q.bind(v); }
    q = q.bind(id);
    Ok(q.fetch_optional(pool).await?)
}

pub async fn delete_collection(pool: &SqlitePool, id: i64) -> Result<bool> {
    let r = sqlx::query("DELETE FROM collections WHERE id = ?").bind(id).execute(pool).await?;
    Ok(r.rows_affected() > 0)
}

pub async fn get_collection_items(pool: &SqlitePool, collection_id: i64) -> Result<Vec<CollectionItemRow>> {
    Ok(sqlx::query_as::<_, CollectionItemRow>(
        "SELECT * FROM collection_items WHERE collection_id = ? ORDER BY position"
    )
    .bind(collection_id).fetch_all(pool).await?)
}

pub async fn add_collection_item(pool: &SqlitePool, collection_id: i64, movie_id: Option<i64>, series_id: Option<i64>) -> Result<()> {
    let max_pos: (i64,) = sqlx::query_as(
        "SELECT COALESCE(MAX(position), 0) FROM collection_items WHERE collection_id = ?"
    ).bind(collection_id).fetch_one(pool).await?;
    sqlx::query(
        "INSERT INTO collection_items (collection_id, movie_id, series_id, position)
         VALUES (?, ?, ?, ?)"
    )
    .bind(collection_id).bind(movie_id).bind(series_id).bind(max_pos.0 + 1)
    .execute(pool).await?;
    Ok(())
}

pub async fn remove_collection_item(pool: &SqlitePool, item_id: i64) -> Result<bool> {
    let r = sqlx::query("DELETE FROM collection_items WHERE id = ?")
        .bind(item_id).execute(pool).await?;
    Ok(r.rows_affected() > 0)
}

pub async fn reorder_collection_item(pool: &SqlitePool, item_id: i64, new_position: i64) -> Result<()> {
    sqlx::query("UPDATE collection_items SET position = ? WHERE id = ?")
        .bind(new_position).bind(item_id).execute(pool).await?;
    Ok(())
}

// ============================================================================
// Episodes (update)
// ============================================================================

pub async fn update_episode(pool: &SqlitePool, id: i64, title: Option<&str>, overview: Option<&str>, runtime: Option<i64>) -> Result<Option<Episode>> {
    let mut sets = Vec::new();
    if title.is_some() { sets.push("title = ?"); }
    if overview.is_some() { sets.push("overview = ?"); }
    if runtime.is_some() { sets.push("runtime = ?"); }
    if sets.is_empty() {
        return Ok(sqlx::query_as::<_, Episode>("SELECT * FROM episodes WHERE id = ?")
            .bind(id).fetch_optional(pool).await?);
    }
    sets.push("updated_at = datetime('now')");
    let sql = format!("UPDATE episodes SET {} WHERE id = ? RETURNING *", sets.join(", "));
    let mut q = sqlx::query_as::<_, Episode>(&sql);
    if let Some(v) = title { q = q.bind(v); }
    if let Some(v) = overview { q = q.bind(v); }
    if let Some(v) = runtime { q = q.bind(v); }
    q = q.bind(id);
    Ok(q.fetch_optional(pool).await?)
}

pub async fn get_movie_studios(pool: &SqlitePool, movie_id: i64) -> Result<Vec<MovieStudioRow>> {
    Ok(sqlx::query_as::<_, MovieStudioRow>(
        "SELECT s.id AS studio_id, s.name, s.logo_path, s.country, s.tmdb_id
         FROM studios s JOIN movie_studios ms ON s.id = ms.studio_id
         WHERE ms.movie_id = ?"
    )
    .bind(movie_id)
    .fetch_all(pool)
    .await?)
}

pub async fn get_collections_with_counts(pool: &SqlitePool) -> Result<Vec<CollectionWithCount>> {
    Ok(sqlx::query_as::<_, CollectionWithCount>(
        "SELECT c.*, COALESCE(cnt.n, 0) AS item_count
         FROM collections c
         LEFT JOIN (SELECT collection_id, COUNT(*) AS n FROM collection_items GROUP BY collection_id) cnt
           ON c.id = cnt.collection_id
         ORDER BY c.name"
    )
    .fetch_all(pool)
    .await?)
}

pub async fn create_smart_collection(
    pool: &SqlitePool,
    name: &str,
    description: Option<&str>,
    smart_rules: &str,
) -> Result<Collection> {
    Ok(sqlx::query_as::<_, Collection>(
        "INSERT INTO collections (name, description, is_smart, smart_rules) VALUES (?, ?, 1, ?) RETURNING *"
    )
    .bind(name)
    .bind(description)
    .bind(smart_rules)
    .fetch_one(pool)
    .await?)
}

pub async fn update_smart_rules(
    pool: &SqlitePool,
    id: i64,
    smart_rules: &str,
) -> Result<Option<Collection>> {
    Ok(sqlx::query_as::<_, Collection>(
        "UPDATE collections SET smart_rules = ?, updated_at = datetime('now') WHERE id = ? AND is_smart = 1 RETURNING *"
    )
    .bind(smart_rules)
    .bind(id)
    .fetch_optional(pool)
    .await?)
}

// ============================================================================
// Genres CRUD
// ============================================================================

pub async fn get_genres(pool: &SqlitePool) -> Result<Vec<Genre>> {
    Ok(sqlx::query_as::<_, Genre>("SELECT * FROM genres ORDER BY name")
        .fetch_all(pool).await?)
}

pub async fn create_genre(pool: &SqlitePool, name: &str, tmdb_id: Option<i64>) -> Result<Genre> {
    Ok(sqlx::query_as::<_, Genre>(
        "INSERT OR IGNORE INTO genres (name, tmdb_id) VALUES (?, ?)
         ON CONFLICT(name) DO UPDATE SET name = name
         RETURNING *"
    )
    .bind(name).bind(tmdb_id)
    .fetch_one(pool).await?)
}

pub async fn delete_genre(pool: &SqlitePool, id: i64) -> Result<bool> {
    let result = sqlx::query("DELETE FROM genres WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn update_genre(pool: &SqlitePool, id: i64, name: &str) -> Result<Option<Genre>> {
    Ok(sqlx::query_as::<_, Genre>(
        "UPDATE genres SET name = ? WHERE id = ? RETURNING *"
    )
    .bind(name).bind(id)
    .fetch_optional(pool).await?)
}

pub async fn get_movie_genres(pool: &SqlitePool, movie_id: i64) -> Result<Vec<Genre>> {
    Ok(sqlx::query_as::<_, Genre>(
        "SELECT g.* FROM genres g JOIN movie_genres mg ON g.id = mg.genre_id
         WHERE mg.movie_id = ?"
    )
    .bind(movie_id).fetch_all(pool).await?)
}

pub async fn add_movie_genre(pool: &SqlitePool, movie_id: i64, genre_id: i64) -> Result<()> {
    sqlx::query("INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)")
        .bind(movie_id).bind(genre_id).execute(pool).await?;
    Ok(())
}

// ============================================================================
// Dashboard statistics
// ============================================================================

pub async fn get_dashboard_stats(pool: &SqlitePool) -> Result<DbStats> {
    Ok(sqlx::query_as::<_, DbStats>(
        "SELECT
           (SELECT COUNT(*) FROM movies) AS total_movies,
           (SELECT COUNT(*) FROM series) AS total_series,
           (SELECT COUNT(*) FROM episodes) AS total_episodes,
           (SELECT COUNT(*) FROM media_files) AS total_files,
           (SELECT COALESCE(SUM(file_size), 0) FROM media_files) AS total_size_bytes,
           (SELECT COUNT(*) FROM inbox_items WHERE status = 'pending') AS inbox_pending"
    )
    .fetch_one(pool)
    .await?)
}

/// Top genres by movie count
pub async fn get_genre_stats(pool: &SqlitePool) -> Result<Vec<(String, i64)>> {
    Ok(sqlx::query_as::<_, (String, i64)>(
        "SELECT g.name, COUNT(*) as cnt
         FROM genres g JOIN movie_genres mg ON g.id = mg.genre_id
         GROUP BY g.name ORDER BY cnt DESC LIMIT 10"
    )
    .fetch_all(pool)
    .await?)
}

/// Recent additions (movies + series mixed, last 10)
pub async fn get_recent_additions(pool: &SqlitePool) -> Result<Vec<RecentAddition>> {
    Ok(sqlx::query_as::<_, RecentAddition>(
        "SELECT title, 'movie' AS entity_type, created_at FROM movies
         UNION ALL
         SELECT title, 'series' AS entity_type, created_at FROM series
         ORDER BY created_at DESC LIMIT 10"
    )
    .fetch_all(pool)
    .await?)
}

// ============================================================================
// Similar movies (offline, scoring by shared criteria)
// ============================================================================

/// Find movies similar to a given movie, scored by common directors, actors, genres, tags
pub async fn find_similar_movies(pool: &SqlitePool, movie_id: i64, limit: i64) -> Result<Vec<SimilarMovie>> {
    Ok(sqlx::query_as::<_, SimilarMovie>(
        "WITH target_directors AS (
            SELECT person_id FROM movie_people WHERE movie_id = ? AND role = 'director'
        ),
        target_actors AS (
            SELECT person_id FROM movie_people WHERE movie_id = ? AND role = 'actor'
        ),
        target_genres AS (
            SELECT genre_id FROM movie_genres WHERE movie_id = ?
        ),
        target_tags AS (
            SELECT tag_id FROM movie_tags WHERE movie_id = ?
        ),
        scores AS (
            SELECT m.id, m.title, m.year, m.poster_path, m.primary_quality_score,
                -- Director match = 5 pts each
                (SELECT COUNT(*) FROM movie_people mp
                 WHERE mp.movie_id = m.id AND mp.role = 'director'
                 AND mp.person_id IN (SELECT person_id FROM target_directors)) * 5
                -- Actor match = 2 pts each
                + (SELECT COUNT(*) FROM movie_people mp
                   WHERE mp.movie_id = m.id AND mp.role = 'actor'
                   AND mp.person_id IN (SELECT person_id FROM target_actors)) * 2
                -- Genre match = 3 pts each
                + (SELECT COUNT(*) FROM movie_genres mg
                   WHERE mg.movie_id = m.id
                   AND mg.genre_id IN (SELECT genre_id FROM target_genres)) * 3
                -- Tag match = 1 pt each
                + (SELECT COUNT(*) FROM movie_tags mt
                   WHERE mt.movie_id = m.id
                   AND mt.tag_id IN (SELECT tag_id FROM target_tags)) * 1
                AS score
            FROM movies m
            WHERE m.id != ?
        )
        SELECT id, title, year, poster_path, primary_quality_score, score
        FROM scores
        WHERE score > 0
        ORDER BY score DESC
        LIMIT ?"
    )
    .bind(movie_id).bind(movie_id).bind(movie_id).bind(movie_id).bind(movie_id)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

// ============================================================================
// Duplicate detection
// ============================================================================

/// Exact duplicates: files with the same SHA256 hash
pub async fn find_exact_duplicates(pool: &SqlitePool) -> Result<Vec<DuplicateGroup>> {
    Ok(sqlx::query_as::<_, DuplicateGroup>(
        "SELECT file_hash AS match_key, 'exact' AS match_type,
                COUNT(*) AS file_count,
                GROUP_CONCAT(mf.id, ',') AS file_ids,
                GROUP_CONCAT(mf.file_name, ' | ') AS file_names,
                SUM(mf.file_size) AS total_size
         FROM media_files mf
         WHERE mf.file_hash IS NOT NULL AND mf.file_hash != ''
         GROUP BY mf.file_hash
         HAVING COUNT(*) > 1
         ORDER BY total_size DESC"
    )
    .fetch_all(pool)
    .await?)
}

/// Probable duplicates: movies with same title + year (different versions?)
pub async fn find_probable_movie_duplicates(pool: &SqlitePool) -> Result<Vec<DuplicateGroup>> {
    Ok(sqlx::query_as::<_, DuplicateGroup>(
        "SELECT (m.title || ' (' || COALESCE(m.year, '?') || ')') AS match_key,
                'probable' AS match_type,
                COUNT(*) AS file_count,
                GROUP_CONCAT(m.id, ',') AS file_ids,
                GROUP_CONCAT(m.title, ' | ') AS file_names,
                0 AS total_size
         FROM movies m
         WHERE m.title IS NOT NULL
         GROUP BY LOWER(m.title), m.year
         HAVING COUNT(*) > 1
         ORDER BY m.title"
    )
    .fetch_all(pool)
    .await?)
}

/// Files belonging to the same movie (multiple versions)
pub async fn find_multi_version_movies(pool: &SqlitePool) -> Result<Vec<DuplicateGroup>> {
    Ok(sqlx::query_as::<_, DuplicateGroup>(
        "SELECT m.title || ' (' || COALESCE(m.year, '?') || ')' AS match_key,
                'multi_version' AS match_type,
                COUNT(DISTINCT mv.id) AS file_count,
                GROUP_CONCAT(DISTINCT mv.id) AS file_ids,
                GROUP_CONCAT(DISTINCT COALESCE(mv.label, 'default'), ' | ') AS file_names,
                COALESCE(SUM(mf.file_size), 0) AS total_size
         FROM movies m
         JOIN media_versions mv ON mv.owner_type = 'movie' AND mv.owner_id = m.id
         LEFT JOIN media_files mf ON mf.media_version_id = mv.id
         GROUP BY m.id
         HAVING COUNT(DISTINCT mv.id) > 1
         ORDER BY file_count DESC"
    )
    .fetch_all(pool)
    .await?)
}

// ============================================================================
// Metadata export
// ============================================================================

/// Full movie row for export (flattened)
pub async fn export_movies(pool: &SqlitePool) -> Result<Vec<MovieExportRow>> {
    Ok(sqlx::query_as::<_, MovieExportRow>(
        "SELECT m.id, m.title, m.original_title, m.year, m.runtime, m.overview,
                m.content_rating, m.tagline, m.owned, m.tmdb_id, m.imdb_id,
                m.primary_quality_score,
                (SELECT GROUP_CONCAT(g.name, ', ')
                 FROM genres g JOIN movie_genres mg ON g.id = mg.genre_id
                 WHERE mg.movie_id = m.id) AS genres,
                (SELECT GROUP_CONCAT(p.name, ', ')
                 FROM people p JOIN movie_people mp ON p.id = mp.person_id
                 WHERE mp.movie_id = m.id AND mp.role = 'director') AS directors,
                (SELECT GROUP_CONCAT(p.name, ', ')
                 FROM people p JOIN movie_people mp ON p.id = mp.person_id
                 WHERE mp.movie_id = m.id AND mp.role = 'actor') AS actors,
                (SELECT GROUP_CONCAT(s.name, ', ')
                 FROM studios s JOIN movie_studios ms ON s.id = ms.studio_id
                 WHERE ms.movie_id = m.id) AS studios,
                (SELECT GROUP_CONCAT(t.name, ', ')
                 FROM tags t JOIN movie_tags mt ON t.id = mt.tag_id
                 WHERE mt.movie_id = m.id) AS tags
         FROM movies m
         ORDER BY m.title"
    )
    .fetch_all(pool)
    .await?)
}

/// Full series row for export
pub async fn export_series(pool: &SqlitePool) -> Result<Vec<SeriesExportRow>> {
    Ok(sqlx::query_as::<_, SeriesExportRow>(
        "SELECT s.id, s.title, s.original_title, s.overview,
                s.first_air_date, s.last_air_date, s.status,
                s.total_seasons, s.total_episodes, s.tmdb_id,
                (SELECT GROUP_CONCAT(g.name, ', ')
                 FROM genres g JOIN series_genres sg ON g.id = sg.genre_id
                 WHERE sg.series_id = s.id) AS genres,
                (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id AND e.has_file = 1) AS owned_episodes,
                (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id) AS total_episode_records
         FROM series s
         ORDER BY s.title"
    )
    .fetch_all(pool)
    .await?)
}

// ============================================================================
// Suggestions
// ============================================================================

/// Movies added in the last 30 days
pub async fn get_recently_added_movies(pool: &SqlitePool, limit: i64) -> Result<Vec<SuggestionItem>> {
    Ok(sqlx::query_as::<_, SuggestionItem>(
        "SELECT id, title, 'movie' AS entity_type, year, poster_path, created_at
         FROM movies
         WHERE created_at >= datetime('now', '-30 days')
         ORDER BY created_at DESC
         LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

/// Series with missing episodes (incomplete)
pub async fn get_incomplete_series(pool: &SqlitePool, limit: i64) -> Result<Vec<IncompleteSeriesRow>> {
    Ok(sqlx::query_as::<_, IncompleteSeriesRow>(
        "SELECT s.id, s.title, s.poster_path, s.total_episodes,
                (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id AND e.has_file = 1) AS owned_episodes,
                s.total_episodes - (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id AND e.has_file = 1) AS missing_count
         FROM series s
         WHERE s.total_episodes IS NOT NULL
           AND s.total_episodes > 0
           AND (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id AND e.has_file = 1) < s.total_episodes
           AND (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id AND e.has_file = 1) > 0
         ORDER BY missing_count DESC
         LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

/// Wishlist — movies not yet owned
pub async fn get_wishlist_movies(pool: &SqlitePool, limit: i64) -> Result<Vec<SuggestionItem>> {
    Ok(sqlx::query_as::<_, SuggestionItem>(
        "SELECT id, title, 'movie' AS entity_type, year, poster_path, created_at
         FROM movies
         WHERE owned = 0
         ORDER BY created_at DESC
         LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

// ============================================================================
// App settings
// ============================================================================

pub async fn get_setting(pool: &SqlitePool, key: &str) -> Result<Option<String>> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM app_settings WHERE key = ?"
    )
    .bind(key)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(v,)| v))
}

pub async fn set_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<()> {
    sqlx::query(
        "INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

