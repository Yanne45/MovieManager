import { useState, useMemo, useCallback, useEffect } from "react";
import { SectionTitle, Tag as TagPill, EmptyState, UnderlineInput } from "../components/ui";
import { usePersonMovies, useStudioMovies, useCollectionItems, useAddCollectionItem, useRemoveCollectionItem, useCreateSmartCollection, useSmartCollectionItems, useUpdateSmartRules } from "../lib/hooks";
import { tmdbImageUrl } from "../lib/api";
import type { Person, StudioFull, PersonMovieRow, StudioMovieRow, SmartRuleSet, SmartRule } from "../lib/api";
import { SmartPoster } from "../components/SmartPoster";
import { COLORS, SP, FONT, WEIGHT, RADIUS, SIZES, TRANSITION, flex, btn, input, panel } from "../lib/tokens";

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
  is_smart?: boolean;
  smart_rules?: string | null;
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
    <div style={{ ...flex.row, height: "100%", overflow: "hidden" }}>
      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: SP.huge }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: SP.xl,
          }}
        >
          {filtered.map((actor) => (
            <div
              key={actor.id}
              onClick={() => handleClick(actor)}
              onDoubleClick={() => handleDoubleClick(actor)}
              style={{
                ...flex.rowGap(SP.xl),
                padding: `${SP.xl}px ${SP.xxl}px`,
                borderRadius: RADIUS.lg,
                border: `1px solid ${selectedId === actor.id ? COLORS.primary : COLORS.border}`,
                background: selectedId === actor.id ? COLORS.bgSurfaceAlt : COLORS.bgSurface,
                cursor: "pointer",
                transition: `border-color ${TRANSITION.fast}, background ${TRANSITION.fast}`,
              }}
            >
              <PersonAvatar name={actor.name} photoPath={actor.photo_path} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: FONT.md,
                    fontWeight: WEIGHT.medium,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {actor.name}
                </div>
                <div style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
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
          ...panel.container,
          marginRight: selected ? 0 : -SIZES.detailPanelWidth,
          opacity: selected ? 1 : 0,
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
    <div style={{ padding: SP.xxxl }}>
      {/* Close chevron */}
      {onClose && (
        <div style={{ textAlign: "right", marginBottom: SP.s }}>
          <button
            onClick={onClose}
            title="Fermer le panneau"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: FONT.xl, color: COLORS.textMuted, padding: `${SP.xs}px ${SP.m}px` }}
          >
            ›
          </button>
        </div>
      )}
      {/* Photo */}
      <div style={{ textAlign: "center", marginBottom: SP.xl }}>
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
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: WEIGHT.semi, marginBottom: SP.xs }}>
        {person.name}
      </div>
      <div style={{ textAlign: "center", fontSize: FONT.xs, color: COLORS.textMuted, marginBottom: SP.xl }}>
        {person.primary_role || "Acteur"}
      </div>

      {/* Info fields */}
      <div style={{ fontSize: FONT.xs, color: COLORS.textSecondary, marginBottom: SP.xl }}>
        {person.birth_date && (
          <div style={{ marginBottom: SP.s }}>
            <span style={{ fontSize: FONT.tiny, color: COLORS.textMuted }}>Né(e) le </span>
            {person.birth_date}
            {person.birth_place && <span> — {person.birth_place}</span>}
          </div>
        )}
        {person.death_date && (
          <div style={{ marginBottom: SP.s }}>
            <span style={{ fontSize: FONT.tiny, color: COLORS.textMuted }}>Décédé(e) le </span>
            {person.death_date}
          </div>
        )}
        {person.known_for && (
          <div style={{ marginBottom: SP.s }}>
            <span style={{ fontSize: FONT.tiny, color: COLORS.textMuted }}>Connu(e) pour </span>
            {person.known_for}
          </div>
        )}
      </div>

      {/* Biography */}
      {person.biography && (
        <div style={{ marginBottom: SP.xl }}>
          <SectionTitle>Biographie</SectionTitle>
          <p style={{ fontSize: FONT.xs, color: COLORS.textSecondary, lineHeight: 1.5, marginTop: SP.s }}>
            {person.biography.length > 400 ? person.biography.slice(0, 400) + "…" : person.biography}
          </p>
        </div>
      )}

      {/* Filmography */}
      <SectionTitle>Filmographie ({filmography.length})</SectionTitle>
      <div
        style={{
          marginTop: SP.m,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: SP.m,
        }}
      >
        {filmography.map((m, i) => (
          <FilmographyRow key={`${m.movie_id}-${m.role}-${i}`} movie={m} />
        ))}
      </div>
      {filmography.length === 0 && (
        <div style={{ fontSize: FONT.xs, color: COLORS.textMuted, marginTop: SP.s }}>Aucun film associé</div>
      )}

      {/* Edit button */}
      <div style={{ textAlign: "center", marginTop: SP.xxxl }}>
        <button
          onClick={onEdit}
          style={{
            ...btn.base,
            background: COLORS.bgSurfaceAlt,
            color: COLORS.textMain,
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
        ...flex.rowGap(SP.m),
        padding: SP.s,
        borderRadius: RADIUS.sm,
        background: COLORS.bgSurfaceAlt,
      }}
    >
      {posterUrl ? (
        <img src={posterUrl} alt="" style={{ width: 24, height: 36, objectFit: "cover", borderRadius: SP.xs }} />
      ) : (
        <div style={{ width: 24, height: 36, borderRadius: SP.xs, background: COLORS.border }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FONT.xs, fontWeight: WEIGHT.medium, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {movie.title}
        </div>
        <div style={{ fontSize: 8, color: COLORS.textMuted }}>
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
        ...flex.center,
        width: size,
        height: size,
        borderRadius: size / 2,
        background: COLORS.bgSurfaceAlt,
        fontSize: size * 0.35,
        fontWeight: WEIGHT.semi,
        color: COLORS.textMuted,
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
    <div style={{ ...flex.row, height: "100%", overflow: "hidden" }}>
      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: SP.huge }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: SP.xl,
          }}
        >
          {filtered.map((studio) => (
            <div
              key={studio.id}
              onClick={() => handleClick(studio)}
              onDoubleClick={() => handleDoubleClick(studio)}
              style={{
                padding: `${SP.xxl}px ${SP.xxxl}px`,
                borderRadius: RADIUS.lg,
                border: `1px solid ${selectedId === studio.id ? COLORS.primary : COLORS.border}`,
                background: selectedId === studio.id ? COLORS.bgSurfaceAlt : COLORS.bgSurface,
                cursor: "pointer",
                transition: `border-color ${TRANSITION.fast}, background ${TRANSITION.fast}`,
              }}
            >
              <div style={{ fontSize: FONT.lg, fontWeight: WEIGHT.medium, marginBottom: SP.s }}>{studio.name}</div>
              <div style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
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
          ...panel.container,
          marginRight: selected ? 0 : -SIZES.detailPanelWidth,
          opacity: selected ? 1 : 0,
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
    <div style={{ padding: SP.xxxl }}>
      {/* Close chevron */}
      {onClose && (
        <div style={{ textAlign: "right", marginBottom: SP.s }}>
          <button
            onClick={onClose}
            title="Fermer le panneau"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: FONT.xl, color: COLORS.textMuted, padding: `${SP.xs}px ${SP.m}px` }}
          >
            ›
          </button>
        </div>
      )}
      {/* Logo / Name */}
      <div style={{ textAlign: "center", marginBottom: SP.xl }}>
        <SmartPoster
          entityType="studio"
          entityId={studio.id}
          title={studio.name}
          tmdbPosterPath={studio.logo_path ?? null}
          tmdbId={studio.tmdb_id}
          size="medium"
        />
      </div>

      <div style={{ textAlign: "center", fontSize: 15, fontWeight: WEIGHT.semi, marginBottom: SP.xs }}>
        {studio.name}
      </div>
      <div style={{ textAlign: "center", fontSize: FONT.xs, color: COLORS.textMuted, marginBottom: SP.xl }}>
        {[studio.country, studio.founded_date ? `Fondé en ${studio.founded_date}` : null]
          .filter(Boolean)
          .join(" · ") || "—"}
      </div>

      {/* Description */}
      {studio.description && (
        <div style={{ marginBottom: SP.xl }}>
          <SectionTitle>Description</SectionTitle>
          <p style={{ fontSize: FONT.xs, color: COLORS.textSecondary, lineHeight: 1.5, marginTop: SP.s }}>
            {studio.description.length > 400 ? studio.description.slice(0, 400) + "…" : studio.description}
          </p>
        </div>
      )}

      {/* Films */}
      <SectionTitle>Films ({movies.length})</SectionTitle>
      <div
        style={{
          marginTop: SP.m,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: SP.m,
        }}
      >
        {movies.map((m) => (
          <StudioFilmRow key={m.movie_id} movie={m} />
        ))}
      </div>
      {movies.length === 0 && (
        <div style={{ fontSize: FONT.xs, color: COLORS.textMuted, marginTop: SP.s }}>Aucun film associé</div>
      )}

      {/* Edit button */}
      <div style={{ textAlign: "center", marginTop: SP.xxxl }}>
        <button
          onClick={onEdit}
          style={{
            ...btn.base,
            background: COLORS.bgSurfaceAlt,
            color: COLORS.textMain,
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
        ...flex.rowGap(SP.m),
        padding: SP.s,
        borderRadius: RADIUS.sm,
        background: COLORS.bgSurfaceAlt,
      }}
    >
      {posterUrl ? (
        <img src={posterUrl} alt="" style={{ width: 24, height: 36, objectFit: "cover", borderRadius: SP.xs }} />
      ) : (
        <div style={{ width: 24, height: 36, borderRadius: SP.xs, background: COLORS.border }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FONT.xs, fontWeight: WEIGHT.medium, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {movie.title}
        </div>
        <div style={{ fontSize: 8, color: COLORS.textMuted }}>
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
    <div style={{ flex: 1, overflowY: "auto", padding: SP.huge, maxWidth: 600 }}>
      {/* Create tag */}
      <div style={{ display: "flex", gap: SP.base, marginBottom: SP.huge, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <UnderlineInput label="Nouveau tag" value={newTagName} onChange={setNewTagName} />
        </div>
        <button
          onClick={handleCreate}
          style={{
            ...btn.primary,
            marginBottom: SP.xxxl,
          }}
        >
          Créer
        </button>
      </div>

      {/* Manual tags */}
      <SectionTitle>Tags manuels ({manual.length})</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: SP.base, marginBottom: SP.huge, marginTop: SP.base }}>
        {manual.map((t) => (
          <TagPill
            key={t.id}
            label={`${t.name}${t.usage_count != null ? ` (${t.usage_count})` : ""}`}
            color={t.color || undefined}
            onRemove={onDeleteTag ? () => onDeleteTag(t.id) : undefined}
          />
        ))}
        {manual.length === 0 && (
          <span style={{ fontSize: FONT.base, color: COLORS.textMuted }}>Aucun tag manuel</span>
        )}
      </div>

      {/* Auto tags */}
      <SectionTitle>Tags automatiques ({auto.length})</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: SP.base, marginTop: SP.base }}>
        {auto.map((t) => (
          <TagPill
            key={t.id}
            label={`${t.name}${t.usage_count != null ? ` (${t.usage_count})` : ""}`}
            color="#6B7280"
          />
        ))}
        {auto.length === 0 && (
          <span style={{ fontSize: FONT.base, color: COLORS.textMuted }}>
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
  tags?: { id: number; name: string; color: string | null }[];
  genres?: { id: number; name: string }[];
  onCreateCollection?: (name: string, description?: string) => void;
  onDeleteCollection?: (id: number) => void;
}

export function CollectionsPage({
  collections,
  movieIndex = {},
  seriesIndex = {},
  tags = [],
  genres = [],
  onCreateCollection,
  onDeleteCollection,
}: CollectionsPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState<false | "manual" | "smart">(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Smart collection creation state
  const [smartMatchMode, setSmartMatchMode] = useState<"all" | "any">("all");
  const [smartEntityType, setSmartEntityType] = useState<"" | "movie" | "series">("");
  const [smartRules, setSmartRules] = useState<SmartRule[]>([{ field: "year", op: "gte", value: 2000 }]);
  const createSmart = useCreateSmartCollection();

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
    resetCreateForm();
  };

  const handleCreateSmart = () => {
    if (!newName.trim() || smartRules.length === 0) return;
    const ruleSet: SmartRuleSet = {
      match: smartMatchMode,
      rules: smartRules,
      entity_type: smartEntityType || null,
    };
    createSmart.mutate({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      smartRules: JSON.stringify(ruleSet),
    });
    resetCreateForm();
  };

  const resetCreateForm = () => {
    setShowCreate(false);
    setNewName("");
    setNewDesc("");
    setSmartMatchMode("all");
    setSmartEntityType("");
    setSmartRules([{ field: "year", op: "gte", value: 2000 }]);
  };

  const btnStyle = {
    ...btn.primary,
    padding: `${SP.m}px ${SP.xxl}px`,
  } as const;

  const btnSecondaryStyle = {
    ...btn.base,
    background: COLORS.bgSurfaceAlt,
    color: COLORS.textMain,
  } as const;

  return (
    <div style={{ ...flex.row, height: "100%", overflow: "hidden" }}>
      {/* Left: grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: SP.huge }}>
        <div style={{ ...flex.rowBetween, marginBottom: SP.xxxl }}>
          <SectionTitle>Collections ({collections.length})</SectionTitle>
          <div style={{ ...flex.rowGap(SP.base) }}>
            <button style={btnStyle} onClick={() => setShowCreate(showCreate === "manual" ? false : "manual")}>
              + Collection
            </button>
            <button
              style={{ ...btnStyle, background: "#8B5CF6" }}
              onClick={() => setShowCreate(showCreate === "smart" ? false : "smart")}
            >
              + Smart Collection
            </button>
          </div>
        </div>

        {/* Inline create form — manual */}
        {showCreate === "manual" && (
          <div
            style={{
              marginBottom: SP.xxxl,
              padding: SP.xxxl,
              border: `1px solid ${COLORS.primary}`,
              borderRadius: RADIUS.lg,
              background: COLORS.bgSurface,
            }}
          >
            <div style={{ marginBottom: SP.lg }}>
              <UnderlineInput label="Nom *" value={newName} onChange={setNewName} />
            </div>
            <div style={{ marginBottom: SP.xl }}>
              <UnderlineInput label="Description (optionnel)" value={newDesc} onChange={setNewDesc} />
            </div>
            <div style={{ ...flex.rowGap(SP.base) }}>
              <button style={btnStyle} onClick={handleCreate}>Creer</button>
              <button style={btnSecondaryStyle} onClick={resetCreateForm}>Annuler</button>
            </div>
          </div>
        )}

        {/* Inline create form — smart */}
        {showCreate === "smart" && (
          <div
            style={{
              marginBottom: SP.xxxl,
              padding: SP.xxxl,
              border: "1px solid #8B5CF6",
              borderRadius: RADIUS.lg,
              background: COLORS.bgSurface,
            }}
          >
            <div style={{ marginBottom: SP.lg }}>
              <UnderlineInput label="Nom *" value={newName} onChange={setNewName} />
            </div>
            <div style={{ marginBottom: SP.xl }}>
              <UnderlineInput label="Description (optionnel)" value={newDesc} onChange={setNewDesc} />
            </div>

            {/* Match mode + entity type */}
            <div style={{ ...flex.rowGap(SP.xl), marginBottom: SP.xl }}>
              <label style={{ fontSize: FONT.sm, color: COLORS.textSecondary }}>Correspondance :</label>
              <select
                value={smartMatchMode}
                onChange={(e) => setSmartMatchMode(e.target.value as "all" | "any")}
                style={selectStyle}
              >
                <option value="all">Toutes les regles (ET)</option>
                <option value="any">Au moins une (OU)</option>
              </select>
              <label style={{ fontSize: FONT.sm, color: COLORS.textSecondary, marginLeft: SP.base }}>Type :</label>
              <select
                value={smartEntityType}
                onChange={(e) => setSmartEntityType(e.target.value as "" | "movie" | "series")}
                style={selectStyle}
              >
                <option value="">Films + Series</option>
                <option value="movie">Films uniquement</option>
                <option value="series">Series uniquement</option>
              </select>
            </div>

            {/* Rules editor */}
            <div style={{ marginBottom: SP.xl }}>
              <div style={{ fontSize: FONT.sm, fontWeight: WEIGHT.semi, color: COLORS.textSecondary, marginBottom: SP.m }}>
                Regles
              </div>
              {smartRules.map((rule, idx) => (
                <SmartRuleRow
                  key={idx}
                  rule={rule}
                  tags={tags}
                  genres={genres}
                  onChange={(updated) => {
                    const next = [...smartRules];
                    next[idx] = updated;
                    setSmartRules(next);
                  }}
                  onRemove={() => setSmartRules(smartRules.filter((_, i) => i !== idx))}
                />
              ))}
              <button
                onClick={() => setSmartRules([...smartRules, { field: "year", op: "gte", value: 2000 }])}
                style={{
                  padding: `${SP.xs}px ${SP.lg}px`,
                  borderRadius: RADIUS.sm,
                  border: `1px dashed ${COLORS.border}`,
                  background: "transparent",
                  color: COLORS.textMuted,
                  fontSize: FONT.sm,
                  cursor: "pointer",
                  marginTop: SP.s,
                }}
              >
                + Ajouter une regle
              </button>
            </div>

            <div style={{ ...flex.rowGap(SP.base) }}>
              <button
                style={{ ...btnStyle, background: "#8B5CF6" }}
                onClick={handleCreateSmart}
                disabled={!newName.trim() || smartRules.length === 0}
              >
                Creer Smart Collection
              </button>
              <button style={btnSecondaryStyle} onClick={resetCreateForm}>Annuler</button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: SP.xl,
          }}
        >
          {collections.map((c) => (
            <div
              key={c.id}
              onClick={() => handleClick(c)}
              style={{
                padding: SP.xxxl,
                borderRadius: RADIUS.lg,
                border: `1px solid ${selectedId === c.id ? COLORS.primary : COLORS.border}`,
                background: selectedId === c.id ? COLORS.bgSurfaceAlt : COLORS.bgSurface,
                cursor: "pointer",
                transition: `border-color ${TRANSITION.fast}, background ${TRANSITION.fast}`,
              }}
            >
              <div style={{ ...flex.rowGap(SP.m), marginBottom: SP.s }}>
                <div style={{ fontSize: FONT.lg, fontWeight: WEIGHT.semi }}>{c.name}</div>
                {c.is_smart && (
                  <span style={{
                    fontSize: FONT.tiny,
                    padding: `1px ${SP.m}px`,
                    borderRadius: RADIUS.sm,
                    background: "#8B5CF6",
                    color: "#fff",
                    fontWeight: WEIGHT.semi,
                  }}>
                    SMART
                  </span>
                )}
              </div>
              {c.description && (
                <p style={{ fontSize: FONT.base, color: COLORS.textSecondary, marginBottom: SP.m, lineHeight: 1.4 }}>
                  {c.description}
                </p>
              )}
              <div style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
                {c.is_smart ? "Dynamique" : `${c.item_count} element${c.item_count !== 1 ? "s" : ""}`}
              </div>
            </div>
          ))}
        </div>

        {collections.length === 0 && !showCreate && (
          <EmptyState message="Aucune collection — creez-en une pour organiser votre catalogue" />
        )}
      </div>

      {/* Right: sliding detail panel */}
      <div
        style={{
          ...panel.container,
          marginRight: selected ? 0 : -SIZES.detailPanelWidth,
          opacity: selected ? 1 : 0,
        }}
      >
        {selected && !selected.is_smart && (
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
        {selected && selected.is_smart && (
          <SmartCollectionDetailPanel
            collection={selected}
            tags={tags}
            genres={genres}
            onClose={() => setSelectedId(null)}
            onDelete={onDeleteCollection ? () => { onDeleteCollection(selected.id); setSelectedId(null); } : undefined}
          />
        )}
      </div>
    </div>
  );
}

// ── Smart rule helpers ──

const selectStyle: React.CSSProperties = {
  ...input.select,
};

const SMART_FIELDS = [
  { value: "year", label: "Annee" },
  { value: "tag", label: "Tag" },
  { value: "genre", label: "Genre" },
  { value: "score", label: "Score qualite" },
  { value: "owned", label: "Possede" },
  { value: "content_rating", label: "Classification" },
  { value: "title", label: "Titre (contient)" },
  { value: "status", label: "Statut serie" },
];

const OPS_BY_FIELD: Record<string, { value: string; label: string }[]> = {
  year: [
    { value: "eq", label: "=" },
    { value: "gte", label: ">=" },
    { value: "lte", label: "<=" },
    { value: "gt", label: ">" },
    { value: "lt", label: "<" },
  ],
  score: [
    { value: "eq", label: "=" },
    { value: "gte", label: ">=" },
    { value: "lte", label: "<=" },
  ],
  tag: [
    { value: "has", label: "a le tag" },
    { value: "not_has", label: "n'a pas le tag" },
  ],
  genre: [
    { value: "has", label: "a le genre" },
    { value: "not_has", label: "n'a pas le genre" },
  ],
  owned: [
    { value: "eq", label: "est" },
  ],
  content_rating: [
    { value: "eq", label: "=" },
    { value: "neq", label: "!=" },
  ],
  title: [
    { value: "contains", label: "contient" },
  ],
  status: [
    { value: "eq", label: "=" },
    { value: "neq", label: "!=" },
  ],
};

function SmartRuleRow({
  rule,
  tags,
  genres,
  onChange,
  onRemove,
}: {
  rule: SmartRule;
  tags: { id: number; name: string; color: string | null }[];
  genres: { id: number; name: string }[];
  onChange: (updated: SmartRule) => void;
  onRemove: () => void;
}) {
  const ops = OPS_BY_FIELD[rule.field] || OPS_BY_FIELD.year;

  const handleFieldChange = (field: string) => {
    const defaultOps = OPS_BY_FIELD[field] || OPS_BY_FIELD.year;
    let defaultValue: SmartRule["value"] = "";
    if (field === "year") defaultValue = 2000;
    else if (field === "owned") defaultValue = true;
    else if (field === "tag") defaultValue = tags[0]?.id ?? 0;
    else if (field === "genre") defaultValue = genres[0]?.id ?? 0;
    else if (field === "score") defaultValue = "A";
    onChange({ field, op: defaultOps[0].value, value: defaultValue });
  };

  return (
    <div style={{ ...flex.rowGap(SP.m), marginBottom: SP.m }}>
      {/* Field */}
      <select value={rule.field} onChange={(e) => handleFieldChange(e.target.value)} style={selectStyle}>
        {SMART_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={rule.op}
        onChange={(e) => onChange({ ...rule, op: e.target.value })}
        style={selectStyle}
      >
        {ops.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Value */}
      {rule.field === "tag" ? (
        <select
          value={typeof rule.value === "number" ? rule.value : 0}
          onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
          style={{ ...selectStyle, flex: 1 }}
        >
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      ) : rule.field === "genre" ? (
        <select
          value={typeof rule.value === "number" ? rule.value : 0}
          onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
          style={{ ...selectStyle, flex: 1 }}
        >
          {genres.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      ) : rule.field === "owned" ? (
        <select
          value={rule.value === true || rule.value === "true" ? "true" : "false"}
          onChange={(e) => onChange({ ...rule, value: e.target.value === "true" })}
          style={selectStyle}
        >
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      ) : rule.field === "score" ? (
        <select
          value={String(rule.value)}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          style={selectStyle}
        >
          {["A", "B", "C", "D", "F"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ) : rule.field === "status" ? (
        <select
          value={String(rule.value)}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          style={selectStyle}
        >
          {["Returning Series", "Ended", "Canceled", "In Production", "Planned"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ) : (
        <input
          type={rule.field === "year" ? "number" : "text"}
          value={String(rule.value)}
          onChange={(e) => onChange({ ...rule, value: rule.field === "year" ? Number(e.target.value) : e.target.value })}
          style={{ ...selectStyle, flex: 1, minWidth: 60 }}
        />
      )}

      {/* Remove */}
      <button
        onClick={onRemove}
        style={{
          ...btn.ghost,
          padding: `0 ${SP.s}px`,
          fontSize: FONT.lg,
          color: COLORS.textMuted,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Smart Collection Detail Panel ──

function SmartCollectionDetailPanel({
  collection,
  tags,
  genres,
  onClose,
  onDelete,
}: {
  collection: CollectionItem;
  tags: { id: number; name: string; color: string | null }[];
  genres: { id: number; name: string }[];
  onClose?: () => void;
  onDelete?: () => void;
}) {
  const { data: items = [], isLoading } = useSmartCollectionItems(collection.id);
  const updateRules = useUpdateSmartRules();
  const [editing, setEditing] = useState(false);
  const [editRules, setEditRules] = useState<SmartRule[]>([]);
  const [editMatchMode, setEditMatchMode] = useState<"all" | "any">("all");
  const [editEntityType, setEditEntityType] = useState<"" | "movie" | "series">("");

  const currentRuleSet: SmartRuleSet | null = useMemo(() => {
    if (!collection.smart_rules) return null;
    try { return JSON.parse(collection.smart_rules); } catch { return null; }
  }, [collection.smart_rules]);

  const startEditing = () => {
    if (currentRuleSet) {
      setEditRules(currentRuleSet.rules);
      setEditMatchMode(currentRuleSet.match);
      setEditEntityType((currentRuleSet.entity_type || "") as "" | "movie" | "series");
    }
    setEditing(true);
  };

  const saveRules = () => {
    const ruleSet: SmartRuleSet = {
      match: editMatchMode,
      rules: editRules,
      entity_type: editEntityType || null,
    };
    updateRules.mutate({ id: collection.id, smartRules: JSON.stringify(ruleSet) });
    setEditing(false);
  };

  // Resolve tag/genre names for display
  const tagMap = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t.name])), [tags]);
  const genreMap = useMemo(() => Object.fromEntries(genres.map((g) => [g.id, g.name])), [genres]);

  const ruleLabel = (rule: SmartRule): string => {
    const field = SMART_FIELDS.find((f) => f.value === rule.field)?.label || rule.field;
    const ops = OPS_BY_FIELD[rule.field] || [];
    const opLabel = ops.find((o) => o.value === rule.op)?.label || rule.op;
    let val = String(rule.value);
    if (rule.field === "tag") val = tagMap[Number(rule.value)] || val;
    if (rule.field === "genre") val = genreMap[Number(rule.value)] || val;
    if (rule.field === "owned") val = rule.value ? "Oui" : "Non";
    return `${field} ${opLabel} ${val}`;
  };

  return (
    <div style={{ padding: SP.xxxl }}>
      {onClose && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: SP.s }}>
          <button onClick={onClose} title="Fermer" style={{
            ...btn.ghost, fontSize: FONT.xxl, lineHeight: 1, padding: `${SP.xs}px ${SP.s}px`, borderRadius: RADIUS.sm,
            color: COLORS.textMuted,
          }}>›</button>
        </div>
      )}

      {/* Icon */}
      <div style={{ textAlign: "center", marginBottom: SP.xl }}>
        <div style={{
          ...flex.center, width: 72, height: 72, borderRadius: RADIUS.xl, background: "#8B5CF620",
          fontSize: 28, color: "#8B5CF6", margin: "0 auto",
        }}>
          ⚡
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 15, fontWeight: WEIGHT.semi, marginBottom: SP.s }}>
        {collection.name}
      </div>
      <div style={{ textAlign: "center", fontSize: FONT.sm, color: "#8B5CF6", fontWeight: WEIGHT.semi, marginBottom: SP.xl }}>
        Smart Collection — {items.length} resultat{items.length !== 1 ? "s" : ""}
      </div>

      {collection.description && (
        <div style={{ marginBottom: SP.xxl }}>
          <SectionTitle>Description</SectionTitle>
          <p style={{ fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 1.5, marginTop: SP.s }}>
            {collection.description}
          </p>
        </div>
      )}

      {/* Rules display / edit */}
      <div style={{ marginBottom: SP.xxl }}>
        <div style={{ ...flex.rowBetween, marginBottom: SP.m }}>
          <SectionTitle>Regles</SectionTitle>
          <button
            onClick={editing ? saveRules : startEditing}
            style={{
              ...btn.primary, padding: `${SP.xs}px ${SP.lg}px`,
              background: "#8B5CF6",
            }}
          >
            {editing ? "Sauvegarder" : "Modifier"}
          </button>
        </div>

        {!editing && currentRuleSet && (
          <div>
            <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginBottom: SP.s }}>
              Mode : {currentRuleSet.match === "all" ? "Toutes (ET)" : "Au moins une (OU)"}
              {currentRuleSet.entity_type && ` — ${currentRuleSet.entity_type === "movie" ? "Films" : "Series"} uniquement`}
            </div>
            {currentRuleSet.rules.map((r, i) => (
              <div key={i} style={{
                padding: `${SP.s}px ${SP.base}px`, borderRadius: RADIUS.sm, marginBottom: SP.xs,
                background: COLORS.bgSurfaceAlt, fontSize: FONT.sm,
              }}>
                {ruleLabel(r)}
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div>
            <div style={{ ...flex.rowGap(SP.base), marginBottom: SP.base }}>
              <select value={editMatchMode} onChange={(e) => setEditMatchMode(e.target.value as "all" | "any")} style={selectStyle}>
                <option value="all">Toutes (ET)</option>
                <option value="any">Au moins une (OU)</option>
              </select>
              <select value={editEntityType} onChange={(e) => setEditEntityType(e.target.value as "" | "movie" | "series")} style={selectStyle}>
                <option value="">Films + Series</option>
                <option value="movie">Films</option>
                <option value="series">Series</option>
              </select>
            </div>
            {editRules.map((rule, idx) => (
              <SmartRuleRow
                key={idx}
                rule={rule}
                tags={tags}
                genres={genres}
                onChange={(updated) => { const next = [...editRules]; next[idx] = updated; setEditRules(next); }}
                onRemove={() => setEditRules(editRules.filter((_, i) => i !== idx))}
              />
            ))}
            <button
              onClick={() => setEditRules([...editRules, { field: "year", op: "gte", value: 2000 }])}
              style={{
                padding: `${SP.xs}px ${SP.lg}px`, borderRadius: RADIUS.sm, border: `1px dashed ${COLORS.border}`,
                background: "transparent", color: COLORS.textMuted, fontSize: FONT.sm, cursor: "pointer", marginTop: SP.s,
              }}
            >
              + Ajouter une regle
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <SectionTitle>Resultats ({items.length})</SectionTitle>
      <div>
        {isLoading && (
          <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, paddingTop: SP.base }}>Chargement...</div>
        )}
        {!isLoading && items.length === 0 && (
          <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, paddingTop: SP.s }}>
            Aucun element ne correspond aux regles
          </div>
        )}
        {items.map((item) => (
          <div
            key={`${item.entity_type}-${item.id}`}
            style={{
              ...flex.rowGap(SP.base),
              padding: `${SP.m}px ${SP.base}px`, marginBottom: SP.s, borderRadius: RADIUS.md, background: COLORS.bgSurfaceAlt,
            }}
          >
            {item.poster_path && (
              <img
                src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                alt=""
                style={{ width: 24, height: 36, borderRadius: RADIUS.sm, objectFit: "cover", flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: FONT.base, fontWeight: WEIGHT.medium, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
              {item.year && <div style={{ fontSize: FONT.xs, color: COLORS.textMuted }}>{item.year}</div>}
            </div>
            <span style={{
              fontSize: FONT.tiny, padding: `${SP.xs}px 5px`, borderRadius: RADIUS.sm, flexShrink: 0,
              background: item.entity_type === "movie" ? COLORS.primary : "#8B5CF6", color: "#fff",
            }}>
              {item.entity_type === "movie" ? "Film" : "Serie"}
            </span>
          </div>
        ))}
      </div>

      {onDelete && (
        <div style={{ textAlign: "center", marginTop: SP.huge }}>
          <button onClick={onDelete} style={{
            ...btn.base, border: "1px solid var(--color-danger, #ef4444)",
            background: "transparent", color: "var(--color-danger, #ef4444)",
          }}>
            Supprimer la collection
          </button>
        </div>
      )}
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
    <div style={{ padding: SP.xxxl }}>
      {/* Close button */}
      {onClose && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: SP.s }}>
          <button
            onClick={onClose}
            title="Fermer"
            style={{
              ...btn.ghost, fontSize: FONT.xxl, lineHeight: 1,
              padding: `${SP.xs}px ${SP.s}px`, borderRadius: RADIUS.sm,
              color: COLORS.textMuted,
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* Icon */}
      <div style={{ textAlign: "center", marginBottom: SP.xl }}>
        <div
          style={{
            ...flex.center,
            width: 72,
            height: 72,
            borderRadius: RADIUS.xl,
            background: COLORS.bgSurfaceAlt,
            fontSize: 28,
            color: COLORS.primary,
            margin: "0 auto",
          }}
        >
          ☰
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 15, fontWeight: WEIGHT.semi, marginBottom: SP.s }}>
        {collection.name}
      </div>
      <div style={{ textAlign: "center", fontSize: FONT.sm, color: COLORS.textMuted, marginBottom: SP.xl }}>
        {collection.item_count} élément{collection.item_count !== 1 ? "s" : ""}
      </div>

      {collection.description && (
        <div style={{ marginBottom: SP.xxl }}>
          <SectionTitle>Description</SectionTitle>
          <p style={{ fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 1.5, marginTop: SP.s }}>
            {collection.description}
          </p>
        </div>
      )}

      {/* Content section */}
      <div style={{ ...flex.rowBetween, marginBottom: SP.m }}>
        <SectionTitle>Contenu</SectionTitle>
        <button
          onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); }}
          style={{
            ...btn.primary, padding: `${SP.xs}px ${SP.lg}px`,
          }}
        >
          + Ajouter
        </button>
      </div>

      {/* Inline search to add items */}
      {showSearch && (
        <div style={{ marginBottom: SP.lg }}>
          <input
            autoFocus
            type="text"
            placeholder="Rechercher un film ou une série…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              ...input.base,
              width: "100%",
              border: `1px solid ${COLORS.primary}`,
              background: COLORS.bgSurfaceAlt,
              boxSizing: "border-box",
            }}
          />
          {searchResults.length > 0 && (
            <div
              style={{
                marginTop: SP.s,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.md,
                overflow: "hidden",
              }}
            >
              {searchResults.map((r) => (
                <div
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleAdd(r)}
                  style={{
                    ...flex.rowBetween,
                    padding: `${SP.m}px ${SP.lg}px`,
                    cursor: "pointer",
                    background: COLORS.bgSurface,
                    borderBottom: `1px solid ${COLORS.border}`,
                    fontSize: FONT.base,
                    gap: SP.base,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bgSurfaceAlt)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.bgSurface)}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </span>
                  <span
                    style={{
                      fontSize: FONT.tiny,
                      padding: `${SP.xs}px 5px`,
                      borderRadius: RADIUS.sm,
                      background: r.type === "movie" ? COLORS.primary : "#8B5CF6",
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
            <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, padding: `${SP.m}px 0` }}>
              Aucun résultat
            </div>
          )}
        </div>
      )}

      {/* Items list */}
      <div>
        {isLoading && (
          <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, paddingTop: SP.base }}>Chargement…</div>
        )}
        {!isLoading && items.length === 0 && (
          <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, paddingTop: SP.s }}>
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
                ...flex.rowGap(SP.base),
                padding: `${SP.m}px ${SP.base}px`,
                marginBottom: SP.s,
                borderRadius: RADIUS.md,
                background: COLORS.bgSurfaceAlt,
              }}
            >
              <span style={{ fontSize: FONT.xs, color: COLORS.textMuted, minWidth: SP.xxxl, textAlign: "center" }}>
                {item.position}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: FONT.base,
                    fontWeight: WEIGHT.medium,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </div>
                {item.notes && (
                  <div style={{ fontSize: FONT.xs, color: COLORS.textMuted }}>{item.notes}</div>
                )}
              </div>
              <span
                style={{
                  fontSize: FONT.tiny,
                  padding: `${SP.xs}px 5px`,
                  borderRadius: RADIUS.sm,
                  background: isMovie ? COLORS.primary : "#8B5CF6",
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
                  ...btn.ghost,
                  fontSize: FONT.lg,
                  lineHeight: 1,
                  padding: `0 ${SP.xs}px`,
                  color: COLORS.textMuted,
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
        <div style={{ textAlign: "center", marginTop: SP.huge }}>
          <button
            onClick={onDelete}
            style={{
              ...btn.base,
              border: "1px solid var(--color-danger, #ef4444)",
              background: "transparent",
              color: "var(--color-danger, #ef4444)",
            }}
          >
            Supprimer la collection
          </button>
        </div>
      )}
    </div>
  );
}
