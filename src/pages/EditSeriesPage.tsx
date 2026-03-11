import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Series, Episode, SeasonDetail } from "../lib/api";
import { useUpdateSeries, useAllEntityImages, useSeriesDetail, useUpdateEpisode, useSyncEpisodesFromTmdb } from "../lib/hooks";
import { UnderlineInput, UnderlineTextarea, SectionTitle } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import { LightboxModal } from "../components/LightboxModal";
import { convertFileSrc } from "@tauri-apps/api/core";
import { COLORS, SP, FONT, WEIGHT, RADIUS, flex, btn } from "../lib/tokens";

interface EditSeriesPageProps {
  series: Series;
  onSave: () => void;
  onCancel: () => void;
}

const statuses = [
  { value: "ongoing", label: "En cours" },
  { value: "ended", label: "Terminée" },
  { value: "cancelled", label: "Annulée" },
  { value: "archived", label: "Archivée" },
];

// ============================================================================
// Episodes column components
// ============================================================================

function EpisodeRow({ ep, onSave }: {
  ep: Episode;
  onSave: (id: number, field: "title" | "runtime", value: string) => void;
}) {
  const [title, setTitle] = useState(ep.title ?? "");
  const [runtime, setRuntime] = useState(ep.runtime?.toString() ?? "");

  useEffect(() => { setTitle(ep.title ?? ""); }, [ep.title]);
  useEffect(() => { setRuntime(ep.runtime?.toString() ?? ""); }, [ep.runtime]);

  return (
    <div style={{
      ...flex.rowGap(SP.m),
      padding: `5px ${SP.xl}px`,
      borderBottom: `1px solid ${COLORS.border}`,
    }}>
      {/* has_file indicator */}
      <div
        title={ep.has_file ? "Fichier présent" : "Pas de fichier"}
        style={{
          width: 7, height: 7, borderRadius: RADIUS.full, flexShrink: 0,
          background: ep.has_file ? COLORS.success : COLORS.border,
        }}
      />
      {/* Episode number */}
      <span style={{ fontSize: FONT.xs, color: COLORS.textMuted, minWidth: 24, flexShrink: 0 }}>
        {ep.episode_number}
      </span>
      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== (ep.title ?? "")) onSave(ep.id, "title", title); }}
        placeholder="Titre…"
        style={{
          flex: 1, fontSize: FONT.sm, border: "none", background: "transparent",
          color: COLORS.textMain, minWidth: 0, outline: "none",
        }}
      />
      {/* Runtime */}
      <input
        type="number"
        value={runtime}
        onChange={(e) => setRuntime(e.target.value)}
        onBlur={() => { if (runtime !== (ep.runtime?.toString() ?? "")) onSave(ep.id, "runtime", runtime); }}
        placeholder="—"
        style={{
          width: 34, fontSize: FONT.xs, border: "none", background: "transparent",
          color: COLORS.textMuted, textAlign: "right", outline: "none",
        }}
      />
      <span style={{ fontSize: FONT.tiny, color: COLORS.textMuted, flexShrink: 0 }}>min</span>
    </div>
  );
}

function SeasonSection({ season, onSave }: {
  season: SeasonDetail;
  onSave: (id: number, field: "title" | "runtime", value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const ownedCount = season.episodes.filter((e) => e.has_file).length;

  return (
    <div style={{ marginBottom: 0 }}>
      {/* Season header */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          ...flex.rowBetween,
          padding: `7px ${SP.xl}px`,
          background: COLORS.bgSurface,
          borderBottom: `1px solid ${COLORS.border}`,
          cursor: "pointer",
          position: "sticky", top: 0, zIndex: 1,
        }}
      >
        <div style={flex.rowGap(SP.base)}>
          <span style={{ fontSize: FONT.xs, color: COLORS.textMuted }}>{open ? "▾" : "▸"}</span>
          <span style={{ fontSize: FONT.base, fontWeight: WEIGHT.semi }}>
            {season.title ?? `Saison ${season.season_number}`}
          </span>
        </div>
        <span style={{ fontSize: FONT.xs, color: COLORS.textMuted }}>
          {ownedCount}/{season.episodes.length}
        </span>
      </div>

      {open && season.episodes.map((ep) => (
        <EpisodeRow key={ep.id} ep={ep} onSave={onSave} />
      ))}
    </div>
  );
}

function EpisodesColumn({ seriesId, tmdbId }: { seriesId: number; tmdbId: number | null }) {
  const { data: detail, isLoading } = useSeriesDetail(seriesId);
  const updateEpisode = useUpdateEpisode();
  const syncTmdb = useSyncEpisodesFromTmdb(seriesId);
  const qc = useQueryClient();

  const handleSave = (id: number, field: "title" | "runtime", value: string) => {
    const payload: { id: number; title?: string; runtime?: number } = { id };
    if (field === "title") payload.title = value || undefined;
    if (field === "runtime") {
      const n = parseInt(value);
      if (!isNaN(n) && n > 0) payload.runtime = n;
    }
    updateEpisode.mutate(payload, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["seriesDetail", seriesId] }),
    });
  };

  const totalEpisodes = detail?.seasons.reduce((acc, s) => acc + s.episodes.length, 0) ?? 0;
  const ownedEpisodes = detail?.seasons.reduce(
    (acc, s) => acc + s.episodes.filter((e) => e.has_file).length, 0
  ) ?? 0;

  return (
    <div>
      {/* Column header */}
      <div style={{
        padding: `${SP.xl}px ${SP.xl}px ${SP.base}px`,
        borderBottom: `1px solid ${COLORS.border}`,
        position: "sticky", top: 0, zIndex: 2,
        background: COLORS.bgSurfaceAlt,
      }}>
        <div style={{ ...flex.rowBetween, marginBottom: SP.xs }}>
          <div style={{ fontSize: FONT.md, fontWeight: WEIGHT.semi }}>Épisodes</div>
          {tmdbId && (
            <button
              onClick={() => syncTmdb.mutate()}
              disabled={syncTmdb.isPending}
              title="Remplir titres et infos depuis TMDB"
              style={{
                fontSize: FONT.xs, padding: `${SP.xs + 1}px ${SP.base}px`, border: `1px solid ${COLORS.border}`,
                borderRadius: SP.s, background: "transparent", cursor: "pointer",
                color: syncTmdb.isSuccess ? COLORS.success
                     : syncTmdb.isError ? COLORS.error
                     : COLORS.textMuted,
              }}
            >
              {syncTmdb.isPending ? "Sync…"
               : syncTmdb.isSuccess ? `✓ ${syncTmdb.data} mis à jour`
               : syncTmdb.isError ? "Erreur"
               : "Sync TMDB"}
            </button>
          )}
        </div>
        {!isLoading && (
          <div style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
            {ownedEpisodes}/{totalEpisodes} fichiers présents
          </div>
        )}
      </div>

      {isLoading && (
        <div style={{ padding: SP.xxxl, fontSize: FONT.base, color: COLORS.textMuted }}>Chargement…</div>
      )}

      {!isLoading && !detail?.seasons.length && (
        <div style={{ padding: SP.xxxl, fontSize: FONT.base, color: COLORS.textMuted }}>
          Aucune saison enregistrée.
        </div>
      )}

      {detail?.seasons.map((season) => (
        <SeasonSection key={season.id} season={season} onSave={handleSave} />
      ))}
    </div>
  );
}

export function EditSeriesPage({ series, onSave, onCancel }: EditSeriesPageProps) {
  const [form, setForm] = useState({
    title: series.title,
    original_title: series.original_title ?? "",
    sort_title: series.sort_title ?? "",
    overview: series.overview ?? "",
    first_air_date: series.first_air_date ?? "",
    last_air_date: series.last_air_date ?? "",
    status: series.status,
    content_rating: series.content_rating ?? "",
    tmdb_id: series.tmdb_id?.toString() ?? "",
    imdb_id: series.imdb_id ?? "",
    tvdb_id: series.tvdb_id?.toString() ?? "",
    notes: series.notes ?? "",
    owned: series.owned,
  });
  const [saving, setSaving] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const updateSeries = useUpdateSeries();
  const { data: allImages = [] } = useAllEntityImages("series", series.id);

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const input: Record<string, unknown> = {};
      if (form.title !== series.title) input.title = form.title;
      if (form.original_title !== (series.original_title ?? ""))
        input.original_title = form.original_title || null;
      if (form.sort_title !== (series.sort_title ?? ""))
        input.sort_title = form.sort_title || null;
      if (form.overview !== (series.overview ?? ""))
        input.overview = form.overview || null;
      if (form.first_air_date !== (series.first_air_date ?? ""))
        input.first_air_date = form.first_air_date || null;
      if (form.last_air_date !== (series.last_air_date ?? ""))
        input.last_air_date = form.last_air_date || null;
      if (form.status !== series.status) input.status = form.status;
      if (form.content_rating !== (series.content_rating ?? ""))
        input.content_rating = form.content_rating || null;
      if (form.notes !== (series.notes ?? "")) input.notes = form.notes || null;
      if (form.owned !== series.owned) input.owned = form.owned;

      if (Object.keys(input).length === 0) {
        onCancel();
        return;
      }

      updateSeries.mutate(
        { id: series.id, input },
        {
          onSuccess: () => onSave(),
          onError: (e) => console.error("Save failed:", e),
          onSettled: () => setSaving(false),
        }
      );
    } catch (e) {
      console.error("Save failed:", e);
      setSaving(false);
    }
  };

  // Separate gallery images (non-poster)
  const galleryImages = allImages.filter((img) => img.image_type !== "poster");

  return (
    <div style={{ height: "100%", ...flex.col, background: COLORS.bgSurface }}>
      {/* Header */}
      <div
        style={{
          ...flex.rowBetween,
          padding: `${SP.xl}px ${SP.mega}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <div style={flex.rowGap(SP.xl)}>
          <button
            onClick={onCancel}
            style={{
              ...btn.base,
              padding: `${SP.s}px ${SP.xl}px`,
              background: "transparent",
              color: COLORS.textMain,
            }}
          >
            &larr; Retour
          </button>
          <span style={{ fontSize: FONT.xl, fontWeight: WEIGHT.semi }}>
            {series.title}
          </span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...btn.primary,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {/* Content — 3 independent scrolling columns */}
      <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "220px minmax(340px, 1fr) 380px" }}>
        {/* Col 1: Poster + read-only info */}
        <div style={{ overflowY: "auto", padding: SP.mega, borderRight: `1px solid ${COLORS.border}` }}>
            <SmartPoster
              entityType="series"
              entityId={series.id}
              title={series.title}
              tmdbPosterPath={series.poster_path ?? null}
              tmdbId={series.tmdb_id}
              size="large"
              editable
            />
            <div style={{ marginTop: SP.base, fontSize: FONT.sm, color: COLORS.textMuted }}>
              {series.first_air_date && <div>Première diffusion : {series.first_air_date}</div>}
              {series.last_air_date && <div>Dernière diffusion : {series.last_air_date}</div>}
              {series.tmdb_id && <div>TMDB : {series.tmdb_id}</div>}
              {series.imdb_id && <div>IMDb : {series.imdb_id}</div>}
              {series.tvdb_id && <div>TVDB : {series.tvdb_id}</div>}
            </div>
          </div>

        {/* Col 2: Editable fields */}
        <div style={{ overflowY: "auto", padding: SP.mega, borderRight: `1px solid ${COLORS.border}` }}>
            <SectionTitle>Informations</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xxxl, marginTop: SP.xl }}>
              <UnderlineInput label="Titre" value={form.title} onChange={(v) => set("title", v)} />
              <UnderlineInput label="Titre original" value={form.original_title} onChange={(v) => set("original_title", v)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xxxl, marginTop: SP.xl }}>
              <UnderlineInput label="Titre de tri" value={form.sort_title} onChange={(v) => set("sort_title", v)} />
              <UnderlineInput label="Classification" value={form.content_rating} onChange={(v) => set("content_rating", v)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xxxl, marginTop: SP.xl }}>
              <UnderlineInput label="Première diffusion" value={form.first_air_date} onChange={(v) => set("first_air_date", v)} />
              <UnderlineInput label="Dernière diffusion" value={form.last_air_date} onChange={(v) => set("last_air_date", v)} />
            </div>

            {/* Status pills */}
            <div style={{ marginTop: SP.xxxl }}>
              <div style={{ fontSize: FONT.base, color: COLORS.textMuted, marginBottom: SP.m }}>Statut</div>
              <div style={flex.rowGap(SP.base)}>
                {statuses.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => set("status", s.value)}
                    style={{
                      padding: `${SP.s}px ${SP.xl}px`,
                      borderRadius: RADIUS.full,
                      fontSize: FONT.sm,
                      border: `1px solid ${form.status === s.value ? COLORS.primary : COLORS.border}`,
                      background: form.status === s.value ? COLORS.primarySoft : "transparent",
                      color: form.status === s.value ? COLORS.primary : COLORS.textMuted,
                      fontWeight: form.status === s.value ? WEIGHT.semi : WEIGHT.normal,
                      cursor: "pointer",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: SP.xxxl }}>
              <UnderlineTextarea label="Synopsis" value={form.overview} onChange={(v) => set("overview", v)} rows={5} />
            </div>

            <div style={{ marginTop: SP.xxxl }}>
              <UnderlineTextarea label="Notes" value={form.notes} onChange={(v) => set("notes", v)} rows={3} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: SP.xxxl, marginTop: SP.xxxl }}>
              <UnderlineInput label="TMDB ID" value={form.tmdb_id} onChange={(v) => set("tmdb_id", v)} />
              <UnderlineInput label="IMDB ID" value={form.imdb_id} onChange={(v) => set("imdb_id", v)} />
              <UnderlineInput label="TVDB ID" value={form.tvdb_id} onChange={(v) => set("tvdb_id", v)} />
            </div>

            <label
              style={{
                ...flex.rowGap(SP.base),
                marginTop: SP.xxxl,
                cursor: "pointer",
                color: COLORS.textSecondary,
                fontSize: FONT.md,
              }}
            >
              <input
                type="checkbox"
                checked={form.owned}
                onChange={(e) => set("owned", e.target.checked)}
              />
              Série possédée (décocher pour wishlist)
            </label>

            {/* Image gallery */}
            {galleryImages.length > 0 && (
              <div style={{ marginTop: SP.mega }}>
                <SectionTitle>Images ({galleryImages.length})</SectionTitle>
                <div
                  style={{
                    marginTop: SP.base,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: SP.base,
                  }}
                >
                  {galleryImages.map((img, i) => {
                    const thumbSrc = img.path_thumb ?? img.path_medium;
                    return (
                      <div
                        key={img.id}
                        onClick={() => setLightboxIndex(i)}
                        style={{
                          width: 80,
                          height: 60,
                          borderRadius: SP.s,
                          overflow: "hidden",
                          cursor: "pointer",
                          border: `1px solid ${COLORS.border}`,
                          position: "relative",
                        }}
                      >
                        {thumbSrc ? (
                          <img
                            src={convertFileSrc(thumbSrc)}
                            alt={img.image_type}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            draggable={false}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              background: COLORS.bgSurfaceAlt,
                              ...flex.center,
                              color: COLORS.textMuted,
                              fontSize: FONT.tiny,
                            }}
                          >
                            {img.image_type}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </div>

        {/* Col 3: Episodes */}
        <div style={{ overflowY: "auto", background: COLORS.bgSurfaceAlt }}>
          <EpisodesColumn seriesId={series.id} tmdbId={series.tmdb_id ?? null} />
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <LightboxModal
          images={galleryImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
