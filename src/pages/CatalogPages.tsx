import { useState, useMemo } from "react";
import { SectionTitle, PosterThumb, Tag as TagPill, EmptyState, UnderlineInput } from "../components/ui";

// ============================================================================
// Types
// ============================================================================

export interface Person {
  id: number;
  name: string;
  primary_role: string | null;
  photo_path: string | null;
  movie_count?: number;
}

export interface Studio {
  id: number;
  name: string;
  country: string | null;
  movie_count?: number;
}

export interface TagItem {
  id: number;
  name: string;
  color: string | null;
  auto_generated: boolean;
  usage_count?: number;
}

export interface CollectionItem {
  id: number;
  name: string;
  description: string | null;
  item_count: number;
}

// ============================================================================
// Actors Page
// ============================================================================

interface ActorsPageProps {
  actors: Person[];
  searchQuery: string;
}

export function ActorsPage({ actors, searchQuery }: ActorsPageProps) {
  const filtered = useMemo(() => {
    if (!searchQuery) return actors;
    const q = searchQuery.toLowerCase();
    return actors.filter((a) => a.name.toLowerCase().includes(q));
  }, [actors, searchQuery]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {filtered.map((actor) => (
          <div
            key={actor.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: "var(--bg-surface-alt)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-muted)",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {actor.photo_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${actor.photo_path}`}
                  alt={actor.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                actor.name.split(" ").map((w) => w[0]?.toUpperCase()).join("").slice(0, 2)
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {actor.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {actor.primary_role || "Acteur"}
                {actor.movie_count != null && ` · ${actor.movie_count} film${actor.movie_count !== 1 ? "s" : ""}`}
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <EmptyState message="Aucun acteur trouvé" />}
    </div>
  );
}

// ============================================================================
// Studios Page
// ============================================================================

interface StudiosPageProps {
  studios: Studio[];
  searchQuery: string;
}

export function StudiosPage({ studios, searchQuery }: StudiosPageProps) {
  const filtered = useMemo(() => {
    if (!searchQuery) return studios;
    const q = searchQuery.toLowerCase();
    return studios.filter((s) => s.name.toLowerCase().includes(q));
  }, [studios, searchQuery]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: 12,
        }}
      >
        {filtered.map((studio) => (
          <div
            key={studio.id}
            style={{
              padding: "14px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{studio.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {[studio.country, studio.movie_count != null ? `${studio.movie_count} films` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <EmptyState message="Aucun studio trouvé" />}
    </div>
  );
}

// ============================================================================
// Tags Page
// ============================================================================

interface TagsPageProps {
  tags: TagItem[];
  onCreateTag?: (name: string, color?: string) => void;
  onDeleteTag?: (id: number) => void;
}

export function TagsPage({ tags, onCreateTag, onDeleteTag }: TagsPageProps) {
  const [newTagName, setNewTagName] = useState("");

  const handleCreate = () => {
    if (newTagName.trim()) {
      onCreateTag?.(newTagName.trim());
      setNewTagName("");
    }
  };

  const manual = tags.filter((t) => !t.auto_generated);
  const auto = tags.filter((t) => t.auto_generated);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20, maxWidth: 600 }}>
      {/* Create tag */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <UnderlineInput label="Nouveau tag" value={newTagName} onChange={setNewTagName} />
        </div>
        <button
          onClick={handleCreate}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-primary)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          Créer
        </button>
      </div>

      {/* Manual tags */}
      <SectionTitle>Tags manuels ({manual.length})</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, marginTop: 8 }}>
        {manual.map((t) => (
          <TagPill
            key={t.id}
            label={`${t.name}${t.usage_count != null ? ` (${t.usage_count})` : ""}`}
            color={t.color || undefined}
            onRemove={onDeleteTag ? () => onDeleteTag(t.id) : undefined}
          />
        ))}
        {manual.length === 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun tag manuel</span>
        )}
      </div>

      {/* Auto tags */}
      <SectionTitle>Tags automatiques ({auto.length})</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {auto.map((t) => (
          <TagPill
            key={t.id}
            label={`${t.name}${t.usage_count != null ? ` (${t.usage_count})` : ""}`}
            color="#6B7280"
          />
        ))}
        {auto.length === 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Aucun tag automatique — configurez des règles dans Paramètres
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Collections Page
// ============================================================================

interface CollectionsPageProps {
  collections: CollectionItem[];
  onSelect?: (id: number) => void;
  onCreate?: () => void;
}

export function CollectionsPage({ collections, onSelect, onCreate }: CollectionsPageProps) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionTitle>Collections</SectionTitle>
        <button
          onClick={onCreate}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-primary)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Nouvelle collection
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: 12,
        }}
      >
        {collections.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect?.(c.id)}
            style={{
              padding: 16,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
            {c.description && (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, lineHeight: 1.4 }}>
                {c.description}
              </p>
            )}
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {c.item_count} élément{c.item_count !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>

      {collections.length === 0 && (
        <EmptyState message="Aucune collection — créez-en une pour organiser votre catalogue" />
      )}
    </div>
  );
}
