import { useState, useMemo, useCallback } from "react";
import {
  ScoreBadge,
  StatusBadge,
  CompletenessBar,
  SectionTitle,
  EmptyState,
  usePagination,
  PaginationBar,
} from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import type { SeriesListItem, SeriesDetail, Series, Episode } from "../lib/api";
import type { ActiveFilters } from "../components/FilterBar";
import { useAllEntityImages } from "../lib/hooks";
import type { ImageRecord } from "../lib/api";
import { LightboxModal } from "../components/LightboxModal";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  COLORS, SP, FONT, WEIGHT, RADIUS, SIZES, TRANSITION,
  flex, th, cell, panel,
} from "../lib/tokens";

// ============================================================================
// Series List Page (table + sliding detail panel)
// ============================================================================

interface SeriesPageProps {
  seriesList: SeriesListItem[];
  searchQuery: string;
  filters?: ActiveFilters;
  onSelectSeries: (id: number) => void;
  onEditSeries?: (series: Series) => void;
}

export function SeriesListPage({ seriesList, searchQuery, filters, onSelectSeries, onEditSeries }: SeriesPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let result = seriesList;

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.title.toLowerCase().includes(q));
    }

    // Filters
    if (filters) {
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

  const pagination = usePagination(filtered, 50);

  const selected = useMemo(
    () => seriesList.find((s) => s.id === selectedId) ?? null,
    [seriesList, selectedId]
  );

  const handleClick = useCallback((s: SeriesListItem) => {
    setSelectedId((prev) => (prev === s.id ? null : s.id));
  }, []);

  const handleDoubleClick = useCallback((s: SeriesListItem) => {
    onEditSeries?.(s);
  }, [onEditSeries]);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", height: 0, minHeight: "100%" }}>
      {/* Table + pagination */}
      <div style={{ flex: 1, ...flex.col, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: FONT.md }}>
          <thead>
            <tr style={{ background: COLORS.bgSurfaceAlt, position: "sticky", top: 0, zIndex: 1 }}>
              {["", "Titre", "Années", "Statut", "Saisons", "Complétude"].map((h, i) => (
                <th
                  key={i}
                  style={th.base}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((s, i) => {
              const isSelected = s.id === selectedId;
              return (
                <tr
                  key={s.id}
                  onClick={() => handleClick(s)}
                  onDoubleClick={() => handleDoubleClick(s)}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? COLORS.primarySoft : i % 2 === 0 ? COLORS.bgSurface : "var(--row-odd-bg)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--row-hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = i % 2 === 0 ? COLORS.bgSurface : "var(--row-odd-bg)";
                  }}
                >
                  <td style={{ ...cell.base, width: 42 }}>
                    <SmartPoster entityType="series" entityId={s.id} title={s.title} tmdbPosterPath={s.poster_path} size="small" />
                  </td>
                  <td style={{ ...cell.base, fontWeight: WEIGHT.medium }}>{s.title}</td>
                  <td style={{ ...cell.base, color: COLORS.textMuted }}>
                    {s.first_air_date?.slice(0, 4) || "?"}
                    {s.last_air_date ? `–${s.last_air_date.slice(0, 4)}` : "–…"}
                  </td>
                  <td style={cell.base}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ ...cell.base, color: COLORS.textMuted }}>
                    {s.total_seasons || "—"}
                  </td>
                  <td style={cell.base}>
                    <CompletenessBar
                      owned={s.owned_episodes}
                      total={s.total_episodes || 0}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <PaginationBar
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {/* Sliding detail panel */}
      <div
        style={{
          ...panel.container,
          marginRight: selected ? 0 : -SIZES.detailPanelWidth,
          opacity: selected ? 1 : 0,
        }}
      >
        {selected && (
          <SeriesPreviewPanel
            series={selected}
            onEdit={onEditSeries ? () => onEditSeries(selected) : undefined}
            onViewDetail={() => onSelectSeries(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Series Preview Panel (sidebar with cover, info, synopsis)
// ============================================================================

function SeriesPreviewPanel({
  series,
  onEdit,
  onViewDetail,
  onClose,
}: {
  series: SeriesListItem;
  onEdit?: () => void;
  onViewDetail?: () => void;
  onClose?: () => void;
}) {
  const { data: allImages } = useAllEntityImages("series", series.id);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const galleryImages = allImages?.filter((img) => img.image_type !== "poster") ?? [];

  const openLightbox = (image: ImageRecord) => {
    const allImgs = allImages ?? [];
    const idx = allImgs.findIndex((img) => img.id === image.id);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const yearRange = [
    series.first_air_date?.slice(0, 4) || "?",
    series.last_air_date ? series.last_air_date.slice(0, 4) : "…",
  ].join("–");

  return (
    <div style={{ padding: SP.xxl, textAlign: "center" }}>
      {/* Close chevron */}
      {onClose && (
        <div style={{ textAlign: "right", marginBottom: SP.s }}>
          <button
            onClick={onClose}
            title="Fermer le panneau"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: FONT.xl,
              color: COLORS.textMuted,
              padding: `${SP.xs}px ${SP.m}px`,
            }}
          >
            ›
          </button>
        </div>
      )}
      {/* Poster with edit icon */}
      <div
        style={{ marginBottom: SP.lg, ...flex.center, position: "relative", cursor: "pointer" }}
        onClick={() => {
          const posterImg = allImages?.find((img) => img.image_type === "poster");
          if (posterImg) openLightbox(posterImg);
        }}
      >
        <SmartPoster
          entityType="series"
          entityId={series.id}
          title={series.title}
          tmdbPosterPath={series.poster_path}
          size="large"
        />
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Modifier"
            style={{
              position: "absolute",
              top: SP.s,
              right: SP.s,
              width: SP.mega,
              height: SP.mega,
              borderRadius: RADIUS.full,
              border: "none",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: FONT.base,
              cursor: "pointer",
              ...flex.center,
              zIndex: 1,
            }}
          >
            ✎
          </button>
        )}
      </div>

      {/* Title */}
      <h2 style={{ fontSize: 15, fontWeight: WEIGHT.semi, marginBottom: SP.xs }}>{series.title}</h2>
      {series.original_title && series.original_title !== series.title && (
        <p style={{ fontSize: FONT.xs, color: COLORS.textMuted, marginBottom: 3 }}>
          {series.original_title}
        </p>
      )}

      {/* Year + status */}
      <div style={{ ...flex.center, gap: SP.m, marginBottom: SP.base }}>
        <span style={{ fontSize: FONT.xs, color: COLORS.textSecondary }}>{yearRange}</span>
        <StatusBadge status={series.status} />
      </div>

      {/* Seasons & completeness */}
      <div style={{ marginBottom: SP.lg }}>
        <div style={{ fontSize: FONT.xs, color: COLORS.textMuted, marginBottom: SP.s }}>
          {series.total_seasons ? `${series.total_seasons} saison${(series.total_seasons || 0) > 1 ? "s" : ""}` : "—"}
          {" · "}
          {series.owned_episodes}/{series.total_episodes || 0} épisodes
        </div>
        <CompletenessBar
          owned={series.owned_episodes}
          total={series.total_episodes || 0}
          width={200}
        />
      </div>

      {/* Synopsis */}
      {series.overview && (
        <div style={{ marginBottom: SP.lg, textAlign: "left" }}>
          <SectionTitle>Synopsis</SectionTitle>
          <p style={{ fontSize: FONT.xs, color: COLORS.textSecondary, lineHeight: 1.5 }}>
            {series.overview.length > 500 ? series.overview.slice(0, 500) + "…" : series.overview}
          </p>
        </div>
      )}

      {/* Content rating */}
      {series.content_rating && (
        <div style={{ fontSize: FONT.xs, color: COLORS.textMuted, marginBottom: SP.base }}>
          Classification : {series.content_rating}
        </div>
      )}

      {/* Image Gallery */}
      {galleryImages.length > 0 && (
        <div style={{ marginBottom: SP.lg, textAlign: "left" }}>
          <SectionTitle>Images ({galleryImages.length})</SectionTitle>
          <div style={{ display: "flex", gap: SP.s, flexWrap: "wrap", marginTop: SP.s }}>
            {galleryImages.map((img) => {
              const thumbSrc = img.path_thumb ?? img.path_medium;
              return (
                <div
                  key={img.id}
                  onClick={() => openLightbox(img)}
                  style={{
                    width: 72,
                    height: 48,
                    borderRadius: 4,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: COLORS.bgSurfaceAlt,
                    border: `1px solid ${COLORS.border}`,
                    transition: `opacity ${TRANSITION.fast}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {thumbSrc ? (
                    <img
                      src={convertFileSrc(thumbSrc)}
                      alt={img.image_type}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      draggable={false}
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      ...flex.center,
                      color: COLORS.textMuted, fontSize: FONT.tiny,
                    }}>
                      {img.image_type}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IDs */}
      <div style={{ marginBottom: SP.lg, textAlign: "left" }}>
        <SectionTitle>Identifiants</SectionTitle>
        <div style={{ fontSize: FONT.tiny, color: COLORS.textMuted, display: "grid", gridTemplateColumns: "50px 1fr", rowGap: SP.xs }}>
          {series.tmdb_id && (<><span>TMDB</span><span>{series.tmdb_id}</span></>)}
          {series.imdb_id && (<><span>IMDb</span><span>{series.imdb_id}</span></>)}
          {series.tvdb_id && (<><span>TVDB</span><span>{series.tvdb_id}</span></>)}
        </div>
      </div>

      {/* Notes */}
      {series.notes && (
        <div style={{ textAlign: "left" }}>
          <SectionTitle>Notes</SectionTitle>
          <p style={{ fontSize: FONT.xs, color: COLORS.textSecondary }}>{series.notes}</p>
        </div>
      )}

      {/* View detail button */}
      {onViewDetail && (
        <div style={{ marginTop: SP.xxl }}>
          <button
            onClick={onViewDetail}
            style={{
              padding: `${SP.m}px ${SP.xxxl}px`,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bgSurfaceAlt,
              color: COLORS.textMain,
              fontSize: FONT.sm,
              fontWeight: WEIGHT.medium,
              cursor: "pointer",
            }}
          >
            Voir saisons et épisodes →
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && allImages && (
        <LightboxModal
          images={allImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Series Detail Page (3-column view)
// ============================================================================

interface SeriesDetailPageProps {
  detail: SeriesDetail;
  onBack: () => void;
  onEdit?: () => void;
}

export function SeriesDetailPage({ detail, onBack, onEdit }: SeriesDetailPageProps) {
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);

  const currentSeason = detail.seasons[selectedSeasonIdx] || null;
  const currentEpisode = currentSeason?.episodes.find((e) => e.id === selectedEpisodeId) || null;

  return (
    <div style={{ flex: 1, ...flex.col, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: `${SP.xl}px ${SP.xxxl}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bgSurface,
          ...flex.row,
          gap: SP.xxl,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: COLORS.textSecondary,
          }}
        >
          ←
        </button>
        <SmartPoster entityType="series" entityId={detail.id} title={detail.title} tmdbPosterPath={detail.poster_path} size="medium" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...flex.rowGap(SP.base) }}>
            <h2 style={{ fontSize: 17, fontWeight: WEIGHT.semi }}>{detail.title}</h2>
            <StatusBadge status={detail.status} />
          </div>
          {detail.overview && (
            <p
              style={{
                fontSize: FONT.base,
                color: COLORS.textSecondary,
                marginTop: SP.s,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 600,
              }}
            >
              {detail.overview}
            </p>
          )}
          <div style={{ marginTop: SP.m }}>
            <CompletenessBar
              owned={detail.owned_episodes}
              total={detail.total_episode_count}
              width={120}
            />
          </div>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            title="Modifier la série"
            style={{
              padding: `${SP.s}px ${SP.xl}px`,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
              background: "transparent",
              color: COLORS.textMain,
              fontSize: FONT.sm,
              fontWeight: WEIGHT.medium,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ✎ Modifier
          </button>
        )}
      </div>

      {/* 3-column body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Seasons list */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            borderRight: `1px solid ${COLORS.border}`,
            overflowY: "auto",
            background: COLORS.bgSurface,
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
              pct === 100 ? COLORS.success : pct > 0 ? COLORS.warning : COLORS.error;

            return (
              <button
                key={season.id}
                onClick={() => {
                  setSelectedSeasonIdx(idx);
                  setSelectedEpisodeId(null);
                }}
                style={{
                  ...flex.row,
                  width: "100%",
                  padding: `${SP.lg}px ${SP.xl}px`,
                  fontSize: FONT.md,
                  fontWeight: active ? WEIGHT.semi : WEIGHT.normal,
                  color: active ? COLORS.primary : COLORS.textMain,
                  background: active ? COLORS.primarySoft : "transparent",
                  border: "none",
                  borderBottom: `1px solid ${COLORS.border}`,
                  cursor: "pointer",
                  textAlign: "left",
                  gap: SP.base,
                }}
              >
                <span style={{ color: iconColor, fontSize: FONT.xs }}>{icon}</span>
                <span style={{ flex: 1 }}>
                  {season.season_number === 0
                    ? "Specials"
                    : `S${String(season.season_number).padStart(2, "0")}`}
                </span>
                <span style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
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
                  padding: `${SP.base}px ${SP.xl}px`,
                  fontSize: FONT.base,
                  fontWeight: WEIGHT.semi,
                  color: COLORS.textMuted,
                  background: COLORS.bgSurfaceAlt,
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                {currentSeason.season_number === 0
                  ? "Specials"
                  : currentSeason.title || `Saison ${currentSeason.season_number}`}
                {" — "}
                {currentSeason.owned_count}/{currentSeason.episodes.length} épisodes
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: FONT.md }}>
                <thead>
                  <tr style={{ background: COLORS.bgSurfaceAlt }}>
                    {["N°", ...(hasAbsolute ? ["Abs."] : []), "Titre", "Durée", "Fichier", "Score"].map((h, i) => (
                      <th
                        key={i}
                        style={{
                          ...th.base,
                          fontSize: FONT.sm,
                          padding: `${SP.m}px ${SP.lg}px`,
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
                            ? COLORS.primarySoft
                            : COLORS.bgSurface,
                          opacity: ep.has_file ? 1 : 0.5,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "var(--row-hover-bg)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = COLORS.bgSurface;
                        }}
                      >
                        <td style={{ ...cell.base, width: 40, color: COLORS.textMuted }}>
                          {String(ep.episode_number).padStart(2, "0")}
                        </td>
                        {hasAbsolute && (
                          <td style={{ ...cell.base, width: 40, color: COLORS.textMuted, fontSize: FONT.sm }}>
                            {ep.absolute_number != null ? `#${ep.absolute_number}` : "—"}
                          </td>
                        )}
                        <td style={{ ...cell.base, fontWeight: WEIGHT.medium }}>
                          {ep.title || `Épisode ${ep.episode_number}`}
                        </td>
                        <td style={{ ...cell.base, color: COLORS.textMuted }}>
                          {ep.runtime ? `${ep.runtime} min` : "—"}
                        </td>
                        <td style={cell.base}>
                          <span style={{ color: ep.has_file ? COLORS.success : COLORS.error }}>
                            {ep.has_file ? "✓" : "✗"}
                          </span>
                        </td>
                        <td style={cell.base}>
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
            borderLeft: `1px solid ${COLORS.border}`,
            background: COLORS.bgSurface,
            overflowY: "auto",
            padding: SP.xxxl,
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
      <h3 style={{ fontSize: FONT.lg, fontWeight: WEIGHT.semi, marginBottom: SP.s }}>
        E{String(episode.episode_number).padStart(2, "0")} — {episode.title || "Sans titre"}
      </h3>

      <div
        style={{
          ...flex.row,
          gap: SP.base,
          marginBottom: SP.xl,
          fontSize: FONT.base,
          color: COLORS.textMuted,
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
            color: episode.has_file ? COLORS.success : COLORS.error,
            fontWeight: WEIGHT.semi,
          }}
        >
          {episode.has_file ? "Fichier présent" : "Fichier manquant"}
        </span>
      </div>

      {episode.overview && (
        <div style={{ marginBottom: SP.xxl }}>
          <SectionTitle>Synopsis</SectionTitle>
          <p style={{ fontSize: FONT.base, color: COLORS.textSecondary, lineHeight: 1.55 }}>
            {episode.overview}
          </p>
        </div>
      )}

      {episode.tmdb_id && (
        <div>
          <SectionTitle>Identifiants</SectionTitle>
          <p style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>TMDB: {episode.tmdb_id}</p>
        </div>
      )}
    </>
  );
}
