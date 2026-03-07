import { useState, useMemo, useCallback } from "react";
import { ScoreBadge, SectionTitle, EmptyState } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import type { Movie } from "../lib/api";
import { tmdbImageUrl } from "../lib/api";
import { useKeyboardShortcuts } from "../lib/useKeyboardShortcuts";
import { useImage } from "../lib/useImage";
import { useMovieVersions, useMoviePeople, useSimilarMovies } from "../lib/hooks";
import { useMovieGenres } from "../lib/hooks";
import type { ActiveFilters } from "../components/FilterBar";

interface LibraryPageProps {
  movies: Movie[];
  viewMode: "table" | "gallery";
  searchQuery: string;
  filters?: ActiveFilters;
  onEditMovie?: (movie: Movie) => void;
  onFocusSearch?: () => void;
}

export function LibraryPage({ movies, viewMode, searchQuery, filters, onEditMovie, onFocusSearch }: LibraryPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
    onEscape: useCallback(() => setSelectedId(null), []),
  });

  if (viewMode === "gallery") {
    return <GalleryView movies={filtered} onSelect={setSelectedId} />;
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <MovieTable movies={filtered} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Detail panel */}
      <div
        style={{
          width: 320,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-surface)",
          overflowY: "auto",
        }}
      >
        {selected ? (
          <MovieDetailPanel movie={selected} />
        ) : (
          <EmptyState message="Sélectionnez un film" />
        )}
      </div>
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
}: {
  movies: Movie[];
  selectedId: number | null;
  onSelect: (id: number) => void;
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
          {["", "Titre", "Année", "Durée", "Score", "Format"].map((h, i) => (
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
              onClick={() => onSelect(m.id)}
              style={{
                cursor: "pointer",
                background: isSelected
                  ? "var(--color-primary-soft)"
                  : i % 2 === 0
                    ? "var(--bg-surface)"
                    : "#F8F9FC",
                transition: "background 0.1s",
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
              <td style={{ padding: "6px 10px", width: 42 }}>
                <SmartPoster
                  entityType="movie"
                  entityId={m.id}
                  title={m.title}
                  tmdbPosterPath={m.poster_path}
                  size="small"
                />
              </td>
              <td
                style={{
                  padding: "6px 10px",
                  fontWeight: 500,
                  maxWidth: 260,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.title}
              </td>
              <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                {m.year || "—"}
              </td>
              <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                {m.runtime ? `${m.runtime} min` : "—"}
              </td>
              <td style={{ padding: "6px 10px" }}>
                <ScoreBadge score={m.primary_quality_score} />
              </td>
              <td style={{ padding: "6px 10px", color: "var(--text-secondary)", fontSize: 12 }}>
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
    <div style={{ padding: 16 }}>
      {/* Poster */}
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
        <SmartPoster
          entityType="movie"
          entityId={movie.id}
          title={movie.title}
          tmdbPosterPath={movie.poster_path}
          size="large"
        />
      </div>

      {/* Title + year */}
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>{movie.title}</h2>
      {movie.original_title && movie.original_title !== movie.title && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
          {movie.original_title}
        </p>
      )}
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
        {[movie.year, movie.runtime ? `${movie.runtime} min` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* Score */}
      {movie.primary_quality_score && (
        <div style={{ marginBottom: 12 }}>
          <ScoreBadge score={movie.primary_quality_score} />
        </div>
      )}

      {/* Genres */}
      {genres && genres.length > 0 && (
        <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {genres.map((g) => (
            <span
              key={g.id}
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 10,
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
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Synopsis</SectionTitle>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {movie.overview}
          </p>
        </div>
      )}

      {/* Tagline */}
      {movie.tagline && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 14 }}>
          {movie.tagline}
        </p>
      )}

      {/* Casting */}
      {(directors.length > 0 || actors.length > 0) && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Casting</SectionTitle>
          {directors.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Réalisation</span>
              {directors.map((d) => (
                <div key={d.person_id} style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 8 }}>
                  {d.name}
                </div>
              ))}
            </div>
          )}
          {actors.length > 0 && (
            <div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Acteurs</span>
              {actors.slice(0, 8).map((a) => (
                <div key={a.person_id} style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 8 }}>
                  {a.name}
                  {a.character_name && (
                    <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>— {a.character_name}</span>
                  )}
                </div>
              ))}
              {actors.length > 8 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 8, marginTop: 2 }}>
                  +{actors.length - 8} autres
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Versions */}
      {versions && versions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Versions ({versions.length})</SectionTitle>
          {versions.map((v) => (
            <VersionCard key={v.id} version={v} />
          ))}
        </div>
      )}

      {/* IDs */}
      <div style={{ marginBottom: 14 }}>
        <SectionTitle>Identifiants</SectionTitle>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            display: "grid",
            gridTemplateColumns: "60px 1fr",
            rowGap: 3,
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
        <div>
          <SectionTitle>Notes</SectionTitle>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{movie.notes}</p>
        </div>
      )}

      {/* Similar movies */}
      {similar && similar.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <SectionTitle>Films similaires ({similar.length})</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
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
        padding: "8px 10px",
        borderRadius: 6,
        marginBottom: 4,
        background: "var(--bg-surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>
          {v.label || "Version principale"}
        </span>
        {v.quality_score && <ScoreBadge score={v.quality_score} />}
      </div>
      {techParts.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {techParts.join(" · ")}
        </div>
      )}
      {audioParts.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Audio : {audioParts.join(" · ")}
        </div>
      )}
      {v.video_bitrate && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
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
}: {
  movies: Movie[];
  onSelect: (id: number) => void;
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
        <GalleryCard key={m.id} movie={m} onSelect={onSelect} />
      ))}
      ))}
    </div>
  );
}

// ============================================================================
// Gallery Card (with smart poster)
// ============================================================================

function GalleryCard({ movie: m, onSelect }: { movie: Movie; onSelect: (id: number) => void }) {
  const cachedUrl = useImage("movie", m.id, "poster", "medium");
  const posterSrc = cachedUrl || tmdbImageUrl(m.poster_path, "w342");

  return (
    <div
      onClick={() => onSelect(m.id)}
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
        }}
      >
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
