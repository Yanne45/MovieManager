import { useState, useMemo, useCallback, useEffect } from "react";
import { SectionTitle, Tag as TagPill, EmptyState, UnderlineInput } from "../components/ui";
import { usePersonMovies, useStudioMovies, useCollectionItems, useAddCollectionItem, useRemoveCollectionItem } from "../lib/hooks";
import { tmdbImageUrl } from "../lib/api";
import type { Person, StudioFull, PersonMovieRow, StudioMovieRow } from "../lib/api";
import { SmartPoster } from "../components/SmartPoster";

// ============================================================================
// Re-export local types for Tags/Collections (used by App.tsx)
// ============================================================================

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
  onEditPerson?: (person: Person) => void;
  initialSelectedId?: number | null;
  onSelectedConsumed?: () => void;
}

export function ActorsPage({ actors, searchQuery, onEditPerson, initialSelectedId, onSelectedConsumed }: ActorsPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId ?? null);

  // When navigated from another page with a pre-selected person
  useEffect(() => {
    if (initialSelectedId != null) {
      setSelectedId(initialSelectedId);
      onSelectedConsumed?.();
    }
  }, [initialSelectedId, onSelectedConsumed]);

  const filtered = useMemo(() => {
    if (!searchQuery) return actors;
    const q = searchQuery.toLowerCase();
    return actors.filter((a) => a.name.toLowerCase().includes(q));
  }, [actors, searchQuery]);

  const selected = useMemo(
    () => actors.find((a) => a.id === selectedId) ?? null,
    [actors, selectedId]
  );

  const handleClick = useCallback((actor: Person) => {
    setSelectedId((prev) => (prev === actor.id ? null : actor.id));
  }, []);

  const handleDoubleClick = useCallback(
    (actor: Person) => {
      onEditPerson?.(actor);
    },
    [onEditPerson]
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Grid */}
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
              onClick={() => handleClick(actor)}
              onDoubleClick={() => handleDoubleClick(actor)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${selectedId === actor.id ? "var(--color-primary)" : "var(--border)"}`,
                background: selectedId === actor.id ? "var(--bg-surface-alt)" : "var(--bg-surface)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <PersonAvatar name={actor.name} photoPath={actor.photo_path} size={40} />
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
                </div>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <EmptyState message="Aucun acteur trouvé" />}
      </div>

      {/* Sliding detail panel */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-surface)",
          overflowY: "auto",
          marginRight: selected ? 0 : -340,
          opacity: selected ? 1 : 0,
          transition: "margin-right 0.25s ease, opacity 0.2s ease",
        }}
      >
        {selected && <PersonDetailPanel person={selected} onEdit={() => onEditPerson?.(selected)} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

// ── Person Detail Panel ──

function PersonDetailPanel({ person, onEdit, onClose }: { person: Person; onEdit?: () => void; onClose?: () => void }) {
  const { data: filmography = [] } = usePersonMovies(person.id);

  return (
    <div style={{ padding: 16 }}>
      {/* Close chevron */}
      {onClose && (
        <div style={{ textAlign: "right", marginBottom: 4 }}>
          <button
            onClick={onClose}
            title="Fermer le panneau"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-muted)", padding: "2px 6px" }}
          >
            ›
          </button>
        </div>
      )}
      {/* Photo */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <SmartPoster
          entityType="person"
          entityId={person.id}
          title={person.name}
          tmdbPosterPath={person.photo_path ?? null}
          tmdbId={person.tmdb_id}
          size="medium"
        />
      </div>

      {/* Name */}
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
        {person.name}
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", marginBottom: 12 }}>
        {person.primary_role || "Acteur"}
      </div>

      {/* Info fields */}
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 12 }}>
        {person.birth_date && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Né(e) le </span>
            {person.birth_date}
            {person.birth_place && <span> — {person.birth_place}</span>}
          </div>
        )}
        {person.death_date && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Décédé(e) le </span>
            {person.death_date}
          </div>
        )}
        {person.known_for && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Connu(e) pour </span>
            {person.known_for}
          </div>
        )}
      </div>

      {/* Biography */}
      {person.biography && (
        <div style={{ marginBottom: 12 }}>
          <SectionTitle>Biographie</SectionTitle>
          <p style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 4 }}>
            {person.biography.length > 400 ? person.biography.slice(0, 400) + "…" : person.biography}
          </p>
        </div>
      )}

      {/* Filmography */}
      <SectionTitle>Filmographie ({filmography.length})</SectionTitle>
      <div
        style={{
          marginTop: 6,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 6,
        }}
      >
        {filmography.map((m, i) => (
          <FilmographyRow key={`${m.movie_id}-${m.role}-${i}`} movie={m} />
        ))}
      </div>
      {filmography.length === 0 && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Aucun film associé</div>
      )}

      {/* Edit button */}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <button
          onClick={onEdit}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)",
            color: "var(--text-main)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Modifier
        </button>
      </div>
    </div>
  );
}

function FilmographyRow({ movie }: { movie: PersonMovieRow }) {
  const posterUrl = tmdbImageUrl(movie.poster_path, "w92");
  const roleLabel = movie.role === "actor"
    ? movie.character_name ? `(${movie.character_name})` : "(acteur)"
    : `(${movie.role})`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: 4,
        borderRadius: 4,
        background: "var(--bg-surface-alt)",
      }}
    >
      {posterUrl ? (
        <img src={posterUrl} alt="" style={{ width: 24, height: 36, objectFit: "cover", borderRadius: 2 }} />
      ) : (
        <div style={{ width: 24, height: 36, borderRadius: 2, background: "var(--border)" }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {movie.title}
        </div>
        <div style={{ fontSize: 8, color: "var(--text-muted)" }}>
          {movie.year ?? "—"} {roleLabel}
        </div>
      </div>
    </div>
  );
}

// ── Shared avatar component ──

function PersonAvatar({ name, photoPath, size }: { name: string; photoPath: string | null; size: number }) {
  const url = tmdbImageUrl(photoPath, "w92");
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: "var(--bg-surface-alt)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        fontWeight: 600,
        color: "var(--text-muted)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {url ? (
        <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        name.split(" ").map((w) => w[0]?.toUpperCase()).join("").slice(0, 2)
      )}
    </div>
  );
}

// ============================================================================
// Studios Page
// ============================================================================

interface StudiosPageProps {
  studios: StudioFull[];
  searchQuery: string;
  onEditStudio?: (studio: StudioFull) => void;
}

export function StudiosPage({ studios, searchQuery, onEditStudio }: StudiosPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return studios;
    const q = searchQuery.toLowerCase();
    return studios.filter((s) => s.name.toLowerCase().includes(q));
  }, [studios, searchQuery]);

  const selected = useMemo(
    () => studios.find((s) => s.id === selectedId) ?? null,
    [studios, selectedId]
  );

  const handleClick = useCallback((studio: StudioFull) => {
    setSelectedId((prev) => (prev === studio.id ? null : studio.id));
  }, []);

  const handleDoubleClick = useCallback(
    (studio: StudioFull) => {
      onEditStudio?.(studio);
    },
    [onEditStudio]
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Grid */}
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
              onClick={() => handleClick(studio)}
              onDoubleClick={() => handleDoubleClick(studio)}
              style={{
                padding: "14px 16px",
                borderRadius: 8,
                border: `1px solid ${selectedId === studio.id ? "var(--color-primary)" : "var(--border)"}`,
                background: selectedId === studio.id ? "var(--bg-surface-alt)" : "var(--bg-surface)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{studio.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {[studio.country].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <EmptyState message="Aucun studio trouvé" />}
      </div>

      {/* Sliding detail panel */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-surface)",
          overflowY: "auto",
          marginRight: selected ? 0 : -340,
          opacity: selected ? 1 : 0,
          transition: "margin-right 0.25s ease, opacity 0.2s ease",
        }}
      >
        {selected && <StudioDetailPanel studio={selected} onEdit={() => onEditStudio?.(selected)} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

// ── Studio Detail Panel ──

function StudioDetailPanel({ studio, onEdit, onClose }: { studio: StudioFull; onEdit?: () => void; onClose?: () => void }) {
  const { data: movies = [] } = useStudioMovies(studio.id);

  return (
    <div style={{ padding: 16 }}>
      {/* Close chevron */}
      {onClose && (
        <div style={{ textAlign: "right", marginBottom: 4 }}>
          <button
            onClick={onClose}
            title="Fermer le panneau"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-muted)", padding: "2px 6px" }}
          >
            ›
          </button>
        </div>
      )}
      {/* Logo / Name */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <SmartPoster
          entityType="studio"
          entityId={studio.id}
          title={studio.name}
          tmdbPosterPath={studio.logo_path ?? null}
          tmdbId={studio.tmdb_id}
          size="medium"
        />
      </div>

      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
        {studio.name}
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", marginBottom: 12 }}>
        {[studio.country, studio.founded_date ? `Fondé en ${studio.founded_date}` : null]
          .filter(Boolean)
          .join(" · ") || "—"}
      </div>

      {/* Description */}
      {studio.description && (
        <div style={{ marginBottom: 12 }}>
          <SectionTitle>Description</SectionTitle>
          <p style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 4 }}>
            {studio.description.length > 400 ? studio.description.slice(0, 400) + "…" : studio.description}
          </p>
        </div>
      )}

      {/* Films */}
      <SectionTitle>Films ({movies.length})</SectionTitle>
      <div
        style={{
          marginTop: 6,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 6,
        }}
      >
        {movies.map((m) => (
          <StudioFilmRow key={m.movie_id} movie={m} />
        ))}
      </div>
      {movies.length === 0 && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Aucun film associé</div>
      )}

      {/* Edit button */}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <button
          onClick={onEdit}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)",
            color: "var(--text-main)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Modifier
        </button>
      </div>
    </div>
  );
}

function StudioFilmRow({ movie }: { movie: StudioMovieRow }) {
  const posterUrl = tmdbImageUrl(movie.poster_path, "w92");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: 4,
        borderRadius: 4,
        background: "var(--bg-surface-alt)",
      }}
    >
      {posterUrl ? (
        <img src={posterUrl} alt="" style={{ width: 24, height: 36, objectFit: "cover", borderRadius: 2 }} />
      ) : (
        <div style={{ width: 24, height: 36, borderRadius: 2, background: "var(--border)" }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {movie.title}
        </div>
        <div style={{ fontSize: 8, color: "var(--text-muted)" }}>
          {movie.year ?? "—"}
        </div>
      </div>
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
  movieIndex?: Record<number, string>;
  seriesIndex?: Record<number, string>;
  onCreateCollection?: (name: string, description?: string) => void;
  onDeleteCollection?: (id: number) => void;
}

export function CollectionsPage({
  collections,
  movieIndex = {},
  seriesIndex = {},
  onCreateCollection,
  onDeleteCollection,
}: CollectionsPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const addItem = useAddCollectionItem();
  const removeItem = useRemoveCollectionItem();

  const selected = useMemo(
    () => collections.find((c) => c.id === selectedId) ?? null,
    [collections, selectedId]
  );

  const handleClick = useCallback((c: CollectionItem) => {
    setSelectedId((prev) => (prev === c.id ? null : c.id));
  }, []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateCollection?.(newName.trim(), newDesc.trim() || undefined);
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
  };

  const handleCancelCreate = () => {
    setShowCreate(false);
    setNewName("");
    setNewDesc("");
  };

  const btnStyle = {
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: "var(--color-primary)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  const btnSecondaryStyle = {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-surface-alt)",
    color: "var(--text-main)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  } as const;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionTitle>Collections ({collections.length})</SectionTitle>
          <button style={btnStyle} onClick={() => setShowCreate((v) => !v)}>
            + Nouvelle collection
          </button>
        </div>

        {/* Inline create form */}
        {showCreate && (
          <div
            style={{
              marginBottom: 16,
              padding: 16,
              border: "1px solid var(--color-primary)",
              borderRadius: 8,
              background: "var(--bg-surface)",
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <UnderlineInput label="Nom *" value={newName} onChange={setNewName} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <UnderlineInput label="Description (optionnel)" value={newDesc} onChange={setNewDesc} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnStyle} onClick={handleCreate}>
                Créer
              </button>
              <button style={btnSecondaryStyle} onClick={handleCancelCreate}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
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
              onClick={() => handleClick(c)}
              style={{
                padding: 16,
                borderRadius: 8,
                border: `1px solid ${selectedId === c.id ? "var(--color-primary)" : "var(--border)"}`,
                background: selectedId === c.id ? "var(--bg-surface-alt)" : "var(--bg-surface)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
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

        {collections.length === 0 && !showCreate && (
          <EmptyState message="Aucune collection — créez-en une pour organiser votre catalogue" />
        )}
      </div>

      {/* Right: sliding detail panel */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-surface)",
          overflowY: "auto",
          marginRight: selected ? 0 : -340,
          opacity: selected ? 1 : 0,
          transition: "margin-right 0.25s ease, opacity 0.2s ease",
        }}
      >
        {selected && (
          <CollectionDetailPanel
            collection={selected}
            movieIndex={movieIndex}
            seriesIndex={seriesIndex}
            onAddItem={(movieId, seriesId) =>
              addItem.mutate({ collectionId: selected.id, movieId, seriesId })
            }
            onRemoveItem={(itemId) =>
              removeItem.mutate({ itemId, collectionId: selected.id })
            }
            onClose={() => setSelectedId(null)}
            onDelete={onDeleteCollection ? () => { onDeleteCollection(selected.id); setSelectedId(null); } : undefined}
          />
        )}
      </div>
    </div>
  );
}

// ── Collection Detail Panel ──

function CollectionDetailPanel({
  collection,
  movieIndex,
  seriesIndex,
  onAddItem,
  onRemoveItem,
  onClose,
  onDelete,
}: {
  collection: CollectionItem;
  movieIndex: Record<number, string>;
  seriesIndex: Record<number, string>;
  onAddItem?: (movieId?: number, seriesId?: number) => void;
  onRemoveItem?: (itemId: number) => void;
  onClose?: () => void;
  onDelete?: () => void;
}) {
  const { data: items = [], isLoading } = useCollectionItems(collection.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // IDs already in collection (to avoid duplicates)
  const addedMovieIds = useMemo(() => new Set(items.map((i) => i.movie_id).filter(Boolean)), [items]);
  const addedSeriesIds = useMemo(() => new Set(items.map((i) => i.series_id).filter(Boolean)), [items]);

  // Search results: mix movies + series, filtered by query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const movies = Object.entries(movieIndex)
      .filter(([id, title]) => !addedMovieIds.has(Number(id)) && title.toLowerCase().includes(q))
      .slice(0, 5)
      .map(([id, title]) => ({ id: Number(id), title, type: "movie" as const }));
    const series = Object.entries(seriesIndex)
      .filter(([id, title]) => !addedSeriesIds.has(Number(id)) && title.toLowerCase().includes(q))
      .slice(0, 5)
      .map(([id, title]) => ({ id: Number(id), title, type: "series" as const }));
    return [...movies, ...series].slice(0, 8);
  }, [searchQuery, movieIndex, seriesIndex, addedMovieIds, addedSeriesIds]);

  const handleAdd = (result: { id: number; type: "movie" | "series" }) => {
    if (result.type === "movie") onAddItem?.(result.id, undefined);
    else onAddItem?.(undefined, result.id);
    setSearchQuery("");
    setShowSearch(false);
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Close button */}
      {onClose && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button
            onClick={onClose}
            title="Fermer"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 4,
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* Icon */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            background: "var(--bg-surface-alt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            color: "var(--color-primary)",
            margin: "0 auto",
          }}
        >
          ☰
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
        {collection.name}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {collection.item_count} élément{collection.item_count !== 1 ? "s" : ""}
      </div>

      {collection.description && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Description</SectionTitle>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 4 }}>
            {collection.description}
          </p>
        </div>
      )}

      {/* Content section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <SectionTitle>Contenu</SectionTitle>
        <button
          onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); }}
          style={{
            padding: "3px 10px",
            borderRadius: 5,
            border: "none",
            background: "var(--color-primary)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Ajouter
        </button>
      </div>

      {/* Inline search to add items */}
      {showSearch && (
        <div style={{ marginBottom: 10 }}>
          <input
            autoFocus
            type="text"
            placeholder="Rechercher un film ou une série…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-primary)",
              background: "var(--bg-surface-alt)",
              color: "var(--text-main)",
              fontSize: 12,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          {searchResults.length > 0 && (
            <div
              style={{
                marginTop: 4,
                border: "1px solid var(--border)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {searchResults.map((r) => (
                <div
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleAdd(r)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    cursor: "pointer",
                    background: "var(--bg-surface)",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12,
                    gap: 8,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      padding: "2px 5px",
                      borderRadius: 4,
                      background: r.type === "movie" ? "var(--color-primary)" : "#8B5CF6",
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {r.type === "movie" ? "Film" : "Série"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {searchQuery.trim() && searchResults.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "6px 0" }}>
              Aucun résultat
            </div>
          )}
        </div>
      )}

      {/* Items list */}
      <div>
        {isLoading && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 8 }}>Chargement…</div>
        )}
        {!isLoading && items.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 4 }}>
            Collection vide — utilisez "+ Ajouter" pour y ajouter des films ou séries
          </div>
        )}
        {items.map((item) => {
          const isMovie = item.movie_id != null;
          const id = (item.movie_id ?? item.series_id)!;
          const title = isMovie ? (movieIndex[id] ?? `Film #${id}`) : (seriesIndex[id] ?? `Série #${id}`);
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                marginBottom: 4,
                borderRadius: 6,
                background: "var(--bg-surface-alt)",
              }}
            >
              <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 16, textAlign: "center" }}>
                {item.position + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </div>
                {item.notes && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.notes}</div>
                )}
              </div>
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 5px",
                  borderRadius: 4,
                  background: isMovie ? "var(--color-primary)" : "#8B5CF6",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {isMovie ? "Film" : "Série"}
              </span>
              <button
                onClick={() => onRemoveItem?.(item.id)}
                title="Retirer de la collection"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: "0 2px",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Delete collection button */}
      {onDelete && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={onDelete}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "1px solid var(--color-danger, #ef4444)",
              background: "transparent",
              color: "var(--color-danger, #ef4444)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Supprimer la collection
          </button>
        </div>
      )}
    </div>
  );
}
