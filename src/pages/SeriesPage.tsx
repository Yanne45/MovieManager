import { useState, useMemo } from "react";
import {
  ScoreBadge,
  StatusBadge,
  CompletenessBar,
  SectionTitle,
  EmptyState,
} from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import type { SeriesListItem, SeriesDetail, Episode } from "../lib/api";
import type { ActiveFilters } from "../components/FilterBar";

// ============================================================================
// Series List Page (table with completeness)
// ============================================================================

interface SeriesPageProps {
  seriesList: SeriesListItem[];
  searchQuery: string;
  filters?: ActiveFilters;
  onSelectSeries: (id: number) => void;
}

export function SeriesListPage({ seriesList, searchQuery, filters, onSelectSeries }: SeriesPageProps) {
  const filtered = useMemo(() => {
    let result = seriesList;

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.title.toLowerCase().includes(q));
    }

    // Filters
    if (filters) {
      if (filters.score) {
        // Series don't have a single score — skip for now
      }
      if (filters.yearFrom) {
        result = result.filter((s) => {
          const year = s.first_air_date ? parseInt(s.first_air_date.slice(0, 4)) : null;
          return year != null && year >= filters.yearFrom!;
        });
      }
      if (filters.yearTo) {
        result = result.filter((s) => {
          const year = s.first_air_date ? parseInt(s.first_air_date.slice(0, 4)) : null;
          return year != null && year <= filters.yearTo!;
        });
      }
      if (filters.completeness === "complete") {
        result = result.filter((s) => s.completeness_percent >= 100);
      } else if (filters.completeness === "incomplete") {
        result = result.filter((s) => s.completeness_percent > 0 && s.completeness_percent < 100);
      } else if (filters.completeness === "empty") {
        result = result.filter((s) => s.owned_episodes === 0);
      }
    }

    return result;
  }, [seriesList, searchQuery, filters]);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-surface-alt)", position: "sticky", top: 0, zIndex: 1 }}>
            {["", "Titre", "Années", "Statut", "Saisons", "Complétude", "Genre"].map((h, i) => (
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
          {filtered.map((s, i) => (
            <tr
              key={s.id}
              onClick={() => onSelectSeries(s.id)}
              style={{
                cursor: "pointer",
                background: i % 2 === 0 ? "var(--bg-surface)" : "#F8F9FC",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5FF")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  i % 2 === 0 ? "var(--bg-surface)" : "#F8F9FC")
              }
            >
              <td style={{ padding: "6px 10px", width: 42 }}>
                <SmartPoster entityType="series" entityId={s.id} title={s.title} tmdbPosterPath={s.poster_path} size="small" />
              </td>
              <td style={{ padding: "6px 10px", fontWeight: 500 }}>{s.title}</td>
              <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                {s.first_air_date?.slice(0, 4) || "?"}
                {s.last_air_date ? `–${s.last_air_date.slice(0, 4)}` : "–…"}
              </td>
              <td style={{ padding: "6px 10px" }}>
                <StatusBadge status={s.status} />
              </td>
              <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                {s.total_seasons || "—"}
              </td>
              <td style={{ padding: "6px 10px" }}>
                <CompletenessBar
                  owned={s.owned_episodes}
                  total={s.total_episodes || 0}
                />
              </td>
              <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Series Detail Page (3-column view)
// ============================================================================

interface SeriesDetailPageProps {
  detail: SeriesDetail;
  onBack: () => void;
}

export function SeriesDetailPage({ detail, onBack }: SeriesDetailPageProps) {
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);

  const currentSeason = detail.seasons[selectedSeasonIdx] || null;
  const currentEpisode = currentSeason?.episodes.find((e) => e.id === selectedEpisodeId) || null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: "var(--text-secondary)",
          }}
        >
          ←
        </button>
        <SmartPoster entityType="series" entityId={detail.id} title={detail.title} tmdbPosterPath={detail.poster_path} size="medium" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>{detail.title}</h2>
            <StatusBadge status={detail.status} />
          </div>
          {detail.overview && (
            <p
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 600,
              }}
            >
              {detail.overview}
            </p>
          )}
          <div style={{ marginTop: 6 }}>
            <CompletenessBar
              owned={detail.owned_episodes}
              total={detail.total_episode_count}
              width={120}
            />
          </div>
        </div>
      </div>

      {/* 3-column body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Seasons list */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            background: "var(--bg-surface)",
          }}
        >
          {detail.seasons.map((season, idx) => {
            const active = idx === selectedSeasonIdx;
            const pct =
              season.episodes.length > 0
                ? Math.round((season.owned_count / season.episodes.length) * 100)
                : 0;
            const icon = pct === 100 ? "●" : pct > 0 ? "◐" : "○";
            const iconColor =
              pct === 100 ? "var(--success)" : pct > 0 ? "var(--warning)" : "var(--error)";

            return (
              <button
                key={season.id}
                onClick={() => {
                  setSelectedSeasonIdx(idx);
                  setSelectedEpisodeId(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--color-primary)" : "var(--text-main)",
                  background: active ? "var(--color-primary-soft)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: 8,
                }}
              >
                <span style={{ color: iconColor, fontSize: 10 }}>{icon}</span>
                <span style={{ flex: 1 }}>
                  {season.season_number === 0
                    ? "Specials"
                    : `S${String(season.season_number).padStart(2, "0")}`}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {season.owned_count}/{season.episodes.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Center: Episodes table */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {currentSeason && (() => {
            const hasAbsolute = currentSeason.episodes.some((ep) => ep.absolute_number != null);
            return (
            <>
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  background: "var(--bg-surface-alt)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {currentSeason.season_number === 0
                  ? "Specials"
                  : currentSeason.title || `Saison ${currentSeason.season_number}`}
                {" — "}
                {currentSeason.owned_count}/{currentSeason.episodes.length} épisodes
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface-alt)" }}>
                    {["N°", ...(hasAbsolute ? ["Abs."] : []), "Titre", "Durée", "Fichier", "Score"].map((h, i) => (
                      <th
                        key={i}
                        style={{
                          padding: "6px 10px",
                          textAlign: "left",
                          fontWeight: 500,
                          color: "var(--text-secondary)",
                          fontSize: 11,
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentSeason.episodes.map((ep) => {
                    const isSelected = ep.id === selectedEpisodeId;
                    return (
                      <tr
                        key={ep.id}
                        onClick={() => setSelectedEpisodeId(ep.id)}
                        style={{
                          cursor: "pointer",
                          background: isSelected
                            ? "var(--color-primary-soft)"
                            : "var(--bg-surface)",
                          opacity: ep.has_file ? 1 : 0.5,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "#F1F5FF";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "var(--bg-surface)";
                        }}
                      >
                        <td style={{ padding: "6px 10px", width: 40, color: "var(--text-muted)" }}>
                          {String(ep.episode_number).padStart(2, "0")}
                        </td>
                        {hasAbsolute && (
                          <td style={{ padding: "6px 10px", width: 40, color: "var(--text-muted)", fontSize: 11 }}>
                            {ep.absolute_number != null ? `#${ep.absolute_number}` : "—"}
                          </td>
                        )}
                        <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                          {ep.title || `Épisode ${ep.episode_number}`}
                        </td>
                        <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                          {ep.runtime ? `${ep.runtime} min` : "—"}
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          <span style={{ color: ep.has_file ? "var(--success)" : "var(--error)" }}>
                            {ep.has_file ? "✓" : "✗"}
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          {ep.has_file ? <ScoreBadge score="B" /> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
            );
          })()}
        </div>

        {/* Right: Episode detail */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-surface)",
            overflowY: "auto",
            padding: 16,
          }}
        >
          {currentEpisode ? (
            <EpisodeDetailPanel episode={currentEpisode} />
          ) : (
            <EmptyState message="Sélectionnez un épisode" />
          )}
        </div>
      </div>
    </div>
  );
}

function EpisodeDetailPanel({ episode }: { episode: Episode }) {
  return (
    <>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        E{String(episode.episode_number).padStart(2, "0")} — {episode.title || "Sans titre"}
      </h3>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        {episode.absolute_number != null && (
          <span title="Numérotation absolue">#{episode.absolute_number}</span>
        )}
        {episode.runtime && <span>{episode.absolute_number != null ? "· " : ""}{episode.runtime} min</span>}
        {episode.air_date && <span>· {episode.air_date}</span>}
        <span
          style={{
            marginLeft: "auto",
            color: episode.has_file ? "var(--success)" : "var(--error)",
            fontWeight: 600,
          }}
        >
          {episode.has_file ? "Fichier présent" : "Fichier manquant"}
        </span>
      </div>

      {episode.overview && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Synopsis</SectionTitle>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {episode.overview}
          </p>
        </div>
      )}

      {episode.tmdb_id && (
        <div>
          <SectionTitle>Identifiants</SectionTitle>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>TMDB: {episode.tmdb_id}</p>
        </div>
      )}
    </>
  );
}
