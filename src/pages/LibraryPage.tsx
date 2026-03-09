import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ScoreBadge, SectionTitle } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import type { Movie } from "../lib/api";
import { tmdbImageUrl } from "../lib/api";
import { useKeyboardShortcuts } from "../lib/useKeyboardShortcuts";
import { useImage } from "../lib/useImage";
import { useMovieVersions, useMoviePeople, useSimilarMovies } from "../lib/hooks";
import { useMovieGenres } from "../lib/hooks";
import type { ActiveFilters } from "../components/FilterBar";

interface CollectionRef { id: number; name: string; }

interface ContextMenuState { x: number; y: number; movieIds: number[]; }

interface LibraryPageProps {
  movies: Movie[];
  viewMode: "table" | "gallery";
  compact?: boolean;
  searchQuery: string;
  filters?: ActiveFilters;
  onEditMovie?: (movie: Movie) => void;
  onFocusSearch?: () => void;
  collections?: CollectionRef[];
  onAddToCollection?: (movieId: number, collectionId: number) => void;
}

export function LibraryPage({ movies, viewMode, compact = false, searchQuery, filters, onEditMovie, onFocusSearch, collections = [], onAddToCollection }: LibraryPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [multiSelect, setMultiSelect] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleMultiToggle = useCallback((movieId: number) => {
    setMultiSelect((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  }, []);

  const clearMultiSelect = useCallback(() => setMultiSelect(new Set()), []);

  const handleContextMenu = useCallback((e: React.MouseEvent, movieId: number) => {
    e.preventDefault();
    if (!collections.length) return;
    // If right-clicking a multi-selected movie, operate on all selected
    const ids = multiSelect.has(movieId) && multiSelect.size > 1
      ? Array.from(multiSelect)
      : [movieId];
    setContextMenu({ x: e.clientX, y: e.clientY, movieIds: ids });
  }, [collections.length, multiSelect]);

  const filtered = useMemo(() => {
    let result = movies;

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.original_title?.toLowerCase().includes(q) ||
          m.year?.toString().includes(q)
      );
    }

    // Filters
    if (filters) {
      if (filters.score) {
        result = result.filter((m) => m.primary_quality_score === filters.score);
      }
      if (filters.yearFrom) {
        result = result.filter((m) => m.year != null && m.year >= filters.yearFrom!);
      }
      if (filters.yearTo) {
        result = result.filter((m) => m.year != null && m.year <= filters.yearTo!);
      }
      if (filters.owned === "yes") {
        result = result.filter((m) => m.owned);
      } else if (filters.owned === "no") {
        result = result.filter((m) => !m.owned);
      }
      // Genre filtering requires genre data on movies — will work when genres
      // are loaded per-movie. For now, genre filter is a no-op placeholder.
    }

    return result;
  }, [movies, searchQuery, filters]);

  const selected = filtered.find((m) => m.id === selectedId) || null;

  // Keyboard navigation
  const selectedIndex = filtered.findIndex((m) => m.id === selectedId);

  useKeyboardShortcuts({
    onArrowUp: useCallback(() => {
      if (filtered.length === 0) return;
      const idx = selectedIndex > 0 ? selectedIndex - 1 : 0;
      setSelectedId(filtered[idx].id);
    }, [filtered, selectedIndex]),
    onArrowDown: useCallback(() => {
      if (filtered.length === 0) return;
      const idx = selectedIndex < filtered.length - 1 ? selectedIndex + 1 : selectedIndex;
      setSelectedId(filtered[idx].id);
    }, [filtered, selectedIndex]),
    onEdit: useCallback(() => {
      if (selected && onEditMovie) onEditMovie(selected);
    }, [selected, onEditMovie]),
    onSearch: onFocusSearch,
    onEscape: useCallback(() => { setSelectedId(null); clearMultiSelect(); }, [clearMultiSelect]),
  });

  const handleAddBatch = useCallback((collectionId: number) => {
    for (const movieId of multiSelect) {
      onAddToCollection?.(movieId, collectionId);
    }
    clearMultiSelect();
  }, [multiSelect, onAddToCollection, clearMultiSelect]);

  if (viewMode === "gallery") {
    return (
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <GalleryView
          movies={filtered}
          onSelect={setSelectedId}
          onContextMenu={handleContextMenu}
          multiSelect={multiSelect}
          onMultiToggle={handleMultiToggle}
        />
        {multiSelect.size > 0 && (
          <SelectionBar
            count={multiSelect.size}
            collections={collections}
            onAddToCollection={handleAddBatch}
            onClear={clearMultiSelect}
          />
        )}
        {contextMenu && (
          <ContextMenu
            {...contextMenu}
            collections={collections}
            onAdd={(collectionId) => {
              contextMenu.movieIds.forEach((id) => onAddToCollection?.(id, collectionId));
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <MovieTable
          movies={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          compact={compact}
          onContextMenu={handleContextMenu}
          multiSelect={multiSelect}
          onMultiToggle={handleMultiToggle}
        />
      </div>

      {/* Sliding detail panel */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-surface)",
          overflowY: "auto",
          transition: "margin-right 0.25s ease, opacity 0.2s ease",
          marginRight: selected ? 0 : -340,
          opacity: selected ? 1 : 0,
        }}
      >
        {selected && <MovieDetailPanel movie={selected} />}
      </div>

      {multiSelect.size > 0 && (
        <SelectionBar
          count={multiSelect.size}
          collections={collections}
          onAddToCollection={handleAddBatch}
          onClear={clearMultiSelect}
        />
      )}

      {contextMenu && (
        <ContextMenu
          {...contextMenu}
          collections={collections}
          onAdd={(collectionId) => {
            contextMenu.movieIds.forEach((id) => onAddToCollection?.(id, collectionId));
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Movie Table
// ============================================================================

function MovieTable({
  movies,
  selectedId,
  onSelect,
  compact = false,
  onContextMenu,
  multiSelect = new Set(),
  onMultiToggle,
}: {
  movies: Movie[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  compact?: boolean;
  onContextMenu?: (e: React.MouseEvent, movieId: number) => void;
  multiSelect?: Set<number>;
  onMultiToggle?: (id: number) => void;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr
          style={{
            background: "var(--bg-surface-alt)",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          {(compact
            ? ["Titre", "Année", "Durée", "Score", "Format"]
            : ["", "Titre", "Année", "Durée", "Score", "Format"]
          ).map((h, i) => (
            <th
              key={i}
              style={{
                padding: "8px 10px",
                textAlign: "left",
                fontWeight: 500,
                color: "var(--text-secondary)",
                fontSize: 12,
                borderBottom: "1px solid var(--border)",
                whiteSpace: "nowrap",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {movies.map((m, i) => {
          const isSelected = m.id === selectedId;
          return (
            <tr
              key={m.id}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) { onMultiToggle?.(m.id); }
                else { onSelect(m.id); }
              }}
              onContextMenu={(e) => onContextMenu?.(e, m.id)}
              style={{
                cursor: "pointer",
                background: multiSelect.has(m.id)
                  ? "#FEF9C3"
                  : isSelected
                    ? "var(--color-primary-soft)"
                    : i % 2 === 0
                      ? "var(--bg-surface)"
                      : "#F8F9FC",
                transition: "background 0.1s",
                outline: multiSelect.has(m.id) ? "2px solid #F59E0B" : undefined,
                outlineOffset: -2,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = "#F1F5FF";
              }}
              onMouseLeave={(e) => {
                if (!isSelected)
                  e.currentTarget.style.background =
                    i % 2 === 0 ? "var(--bg-surface)" : "#F8F9FC";
              }}
            >
              {!compact && (
                <td style={{ padding: "6px 10px", width: 42 }}>
                  <SmartPoster
                    entityType="movie"
                    entityId={m.id}
                    title={m.title}
                    tmdbPosterPath={m.poster_path}
                    size="small"
                  />
                </td>
              )}
              <td
                style={{
                  padding: compact ? "4px 10px" : "6px 10px",
                  maxWidth: 260,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ fontWeight: 500 }}>{m.title}</div>
                <MovieDirectorsLine movieId={m.id} />
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px", color: "var(--text-muted)" }}>
                {m.year || "—"}
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px", color: "var(--text-muted)" }}>
                {m.runtime ? `${m.runtime} min` : "—"}
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px" }}>
                <ScoreBadge score={m.primary_quality_score} />
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px", color: "var(--text-secondary)", fontSize: 12 }}>
                {m.primary_quality_score === "A"
                  ? "4K HDR"
                  : m.primary_quality_score === "B"
                    ? "1080p"
                    : m.primary_quality_score === "C"
                      ? "720p"
                      : "SD"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Displays directors under the movie title in the table row */
function MovieDirectorsLine({ movieId }: { movieId: number }) {
  const { data: people } = useMoviePeople(movieId);
  const directors = people?.filter((p) => p.role === "director") ?? [];
  if (directors.length === 0) return null;
  return (
    <div
      style={{
        fontSize: 9,
        fontStyle: "italic",
        color: "var(--text-muted)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: 1.3,
      }}
    >
      {directors.map((d) => d.name).join(", ")}
    </div>
  );
}

// ============================================================================
// Movie Detail Panel
// ============================================================================

function MovieDetailPanel({ movie }: { movie: Movie }) {
  const { data: versions } = useMovieVersions(movie.id);
  const { data: people } = useMoviePeople(movie.id);
  const { data: genres } = useMovieGenres(movie.id);
  const { data: similar } = useSimilarMovies(movie.id);

  const directors = people?.filter((p) => p.role === "director") ?? [];
  const actors = people?.filter((p) => p.role === "actor") ?? [];

  return (
    <div style={{ padding: 14, textAlign: "center" }}>
      {/* Poster */}
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
        <SmartPoster
          entityType="movie"
          entityId={movie.id}
          title={movie.title}
          tmdbPosterPath={movie.poster_path}
          size="large"
        />
      </div>

      {/* Title + year */}
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{movie.title}</h2>
      {movie.original_title && movie.original_title !== movie.title && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>
          {movie.original_title}
        </p>
      )}
      <p style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 8 }}>
        {[movie.year, movie.runtime ? `${movie.runtime} min` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* Score + Genres on same line */}
      {(movie.primary_quality_score || (genres && genres.length > 0)) && (
        <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", alignItems: "center" }}>
          {movie.primary_quality_score && <ScoreBadge score={movie.primary_quality_score} />}
          {genres && genres.map((g) => (
            <span
              key={g.id}
              style={{
                padding: "1px 6px",
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 500,
                background: "var(--color-primary-soft)",
                color: "var(--color-primary)",
              }}
            >
              {g.name}
            </span>
          ))}
        </div>
      )}

      {/* Synopsis */}
      {movie.overview && (
        <div style={{ marginBottom: 10, textAlign: "left" }}>
          <SectionTitle>Synopsis</SectionTitle>
          <p style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {movie.overview}
          </p>
        </div>
      )}

      {/* Tagline */}
      {movie.tagline && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 10 }}>
          {movie.tagline}
        </p>
      )}

      {/* Casting */}
      {(directors.length > 0 || actors.length > 0) && (
        <div style={{ marginBottom: 10, textAlign: "left" }}>
          <SectionTitle>Casting</SectionTitle>
          {directors.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 500 }}>Réalisation</span>
              {directors.map((d) => (
                <div key={d.person_id} style={{ fontSize: 10, color: "var(--text-secondary)", paddingLeft: 6 }}>
                  {d.name}
                </div>
              ))}
            </div>
          )}
          {actors.length > 0 && (
            <div>
              <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 500 }}>Acteurs</span>
              {actors.slice(0, 6).map((a) => (
                <div key={a.person_id} style={{ fontSize: 10, color: "var(--text-secondary)", paddingLeft: 6 }}>
                  {a.name}
                  {a.character_name && (
                    <span style={{ color: "var(--text-muted)", marginLeft: 3 }}>— {a.character_name}</span>
                  )}
                </div>
              ))}
              {actors.length > 6 && (
                <div style={{ fontSize: 9, color: "var(--text-muted)", paddingLeft: 6, marginTop: 2 }}>
                  +{actors.length - 6} autres
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Versions */}
      {versions && versions.length > 0 && (
        <div style={{ marginBottom: 10, textAlign: "left" }}>
          <SectionTitle>Versions ({versions.length})</SectionTitle>
          {versions.map((v) => (
            <VersionCard key={v.id} version={v} />
          ))}
        </div>
      )}

      {/* IDs */}
      <div style={{ marginBottom: 10, textAlign: "left" }}>
        <SectionTitle>Identifiants</SectionTitle>
        <div
          style={{
            fontSize: 9,
            color: "var(--text-muted)",
            display: "grid",
            gridTemplateColumns: "50px 1fr",
            rowGap: 2,
          }}
        >
          {movie.tmdb_id && (
            <>
              <span>TMDB</span>
              <span>{movie.tmdb_id}</span>
            </>
          )}
          {movie.imdb_id && (
            <>
              <span>IMDb</span>
              <span>{movie.imdb_id}</span>
            </>
          )}
        </div>
      </div>

      {/* Notes */}
      {movie.notes && (
        <div style={{ textAlign: "left" }}>
          <SectionTitle>Notes</SectionTitle>
          <p style={{ fontSize: 10, color: "var(--text-secondary)" }}>{movie.notes}</p>
        </div>
      )}

      {/* Similar movies */}
      {similar && similar.length > 0 && (
        <div style={{ marginTop: 10, textAlign: "left" }}>
          <SectionTitle>Films similaires ({similar.length})</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, justifyContent: "center" }}>
            {similar.map((s) => (
              <div
                key={s.id}
                style={{
                  width: 60,
                  textAlign: "center",
                  cursor: "pointer",
                }}
                title={`${s.title} (${s.year ?? "?"}) — score ${s.score}`}
              >
                <SmartPoster
                  entityType="movie"
                  entityId={s.id}
                  title={s.title}
                  tmdbPosterPath={s.poster_path}
                  size="small"
                />
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Version Card (in detail panel)
// ============================================================================

function VersionCard({ version: v }: { version: import("../lib/api").MediaVersion }) {
  const techParts = [
    v.resolution,
    v.video_codec,
    v.hdr_format,
    v.container?.toUpperCase(),
  ].filter(Boolean);

  const audioParts = [
    v.audio_codec,
    v.audio_channels ? `${v.audio_channels}ch` : null,
  ].filter(Boolean);

  return (
    <div
      style={{
        padding: "5px 8px",
        borderRadius: 5,
        marginBottom: 3,
        background: "var(--bg-surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 600, flex: 1 }}>
          {v.label || "Version principale"}
        </span>
        {v.quality_score && <ScoreBadge score={v.quality_score} />}
      </div>
      {techParts.length > 0 && (
        <div style={{ fontSize: 9, color: "var(--text-secondary)" }}>
          {techParts.join(" · ")}
        </div>
      )}
      {audioParts.length > 0 && (
        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
          Audio : {audioParts.join(" · ")}
        </div>
      )}
      {v.video_bitrate && (
        <div style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 1 }}>
          {Math.round(v.video_bitrate / 1000)} kbps
          {v.duration ? ` · ${Math.round(v.duration / 60)} min` : ""}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Gallery View
// ============================================================================

function GalleryView({
  movies,
  onSelect,
  onContextMenu,
  multiSelect = new Set(),
  onMultiToggle,
}: {
  movies: Movie[];
  onSelect: (id: number) => void;
  onContextMenu?: (e: React.MouseEvent, movieId: number) => void;
  multiSelect?: Set<number>;
  onMultiToggle?: (id: number) => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 20,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 14,
        alignContent: "start",
      }}
    >
      {movies.map((m) => (
        <GalleryCard
          key={m.id}
          movie={m}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          isMultiSelected={multiSelect.has(m.id)}
          onMultiToggle={onMultiToggle}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Gallery Card (with smart poster)
// ============================================================================

function GalleryCard({
  movie: m,
  onSelect,
  onContextMenu,
  isMultiSelected = false,
  onMultiToggle,
}: {
  movie: Movie;
  onSelect: (id: number) => void;
  onContextMenu?: (e: React.MouseEvent, movieId: number) => void;
  isMultiSelected?: boolean;
  onMultiToggle?: (id: number) => void;
}) {
  const cachedUrl = useImage("movie", m.id, "poster", "medium");
  const posterSrc = cachedUrl || tmdbImageUrl(m.poster_path, "w342");

  return (
    <div
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) onMultiToggle?.(m.id);
        else onSelect(m.id);
      }}
      onContextMenu={(e) => onContextMenu?.(e, m.id)}
      style={{ cursor: "pointer", textAlign: "center" }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "150%",
          borderRadius: 6,
          overflow: "hidden",
          background: "var(--bg-surface-alt)",
          outline: isMultiSelected ? "3px solid #F59E0B" : undefined,
          outlineOffset: 2,
        }}
      >
        {isMultiSelected && (
          <div style={{
            position: "absolute",
            top: 6,
            left: 6,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#F59E0B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            fontSize: 11,
            color: "#fff",
            fontWeight: 700,
          }}>✓</div>
        )}
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={m.title}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {m.title.slice(0, 2).toUpperCase()}
          </div>
        )}

        {m.primary_quality_score && (
          <div style={{ position: "absolute", top: 6, right: 6 }}>
            <ScoreBadge score={m.primary_quality_score} />
          </div>
        )}
      </div>
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          marginTop: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {m.title}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.year}</p>
    </div>
  );
}

// ============================================================================
// Selection Bar (floating action bar for multi-select)
// ============================================================================

function SelectionBar({
  count,
  collections,
  onAddToCollection,
  onClear,
}: {
  count: number;
  collections: CollectionRef[];
  onAddToCollection: (collectionId: number) => void;
  onClear: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 20px",
        background: "var(--color-primary)",
        color: "#fff",
        borderRadius: 28,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        zIndex: 200,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontWeight: 600 }}>
        {count} film{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
      </span>

      <div style={{ position: "relative" }} ref={pickerRef}>
        <button
          onClick={() => setShowPicker((v) => !v)}
          style={{
            padding: "5px 14px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.18)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Ajouter à une collection ▾
        </button>

        {showPicker && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              minWidth: 200,
              zIndex: 201,
            }}
          >
            <div
              style={{
                padding: "7px 12px 5px",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Choisir une collection
            </div>
            {collections.length === 0 && (
              <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                Aucune collection
              </div>
            )}
            {collections.map((c) => (
              <div
                key={c.id}
                onClick={() => { onAddToCollection(c.id); setShowPicker(false); }}
                style={{
                  padding: "8px 14px",
                  cursor: "pointer",
                  color: "var(--text-main)",
                  fontSize: 13,
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onClear}
        title="Désélectionner tout"
        style={{
          border: "none",
          background: "transparent",
          color: "rgba(255,255,255,0.8)",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ============================================================================
// Context Menu
// ============================================================================

function ContextMenu({
  x,
  y,
  movieIds,
  collections,
  onAdd,
  onClose,
}: {
  x: number;
  y: number;
  movieIds: number[];
  collections: CollectionRef[];
  onAdd: (collectionId: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Keep menu within viewport
  const menuWidth = 220;
  const left = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const top = y;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left,
        top,
        width: menuWidth,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        zIndex: 9999,
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      <div
        style={{
          padding: "8px 12px 6px",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {movieIds.length > 1 ? `Ajouter ${movieIds.length} films à` : "Ajouter à une collection"}
      </div>
      {collections.length === 0 && (
        <div style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 11 }}>
          Aucune collection
        </div>
      )}
      {collections.map((c) => (
        <div
          key={c.id}
          onClick={() => onAdd(c.id)}
          style={{
            padding: "7px 12px",
            cursor: "pointer",
            color: "var(--text-main)",
            borderBottom: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {c.name}
        </div>
      ))}
    </div>
  );
}
