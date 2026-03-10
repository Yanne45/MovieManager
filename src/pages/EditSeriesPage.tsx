import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Series, Episode, SeasonDetail } from "../lib/api";
import { useUpdateSeries, useAllEntityImages, useSeriesDetail, useUpdateEpisode, useSyncEpisodesFromTmdb } from "../lib/hooks";
import { UnderlineInput, UnderlineTextarea, SectionTitle } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import { LightboxModal } from "../components/LightboxModal";
import { convertFileSrc } from "@tauri-apps/api/core";

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
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 12px",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* has_file indicator */}
      <div
        title={ep.has_file ? "Fichier présent" : "Pas de fichier"}
        style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: ep.has_file ? "var(--success, #27ae60)" : "var(--border)",
        }}
      />
      {/* Episode number */}
      <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 24, flexShrink: 0 }}>
        {ep.episode_number}
      </span>
      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== (ep.title ?? "")) onSave(ep.id, "title", title); }}
        placeholder="Titre…"
        style={{
          flex: 1, fontSize: 11, border: "none", background: "transparent",
          color: "var(--text-main)", minWidth: 0, outline: "none",
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
          width: 34, fontSize: 10, border: "none", background: "transparent",
          color: "var(--text-muted)", textAlign: "right", outline: "none",
        }}
      />
      <span style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>min</span>
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
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 12px",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
          position: "sticky", top: 0, zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{open ? "▾" : "▸"}</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {season.title ?? `Saison ${season.season_number}`}
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
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
        padding: "12px 12px 8px",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 2,
        background: "var(--bg-surface-alt)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Épisodes</div>
          {tmdbId && (
            <button
              onClick={() => syncTmdb.mutate()}
              disabled={syncTmdb.isPending}
              title="Remplir titres et infos depuis TMDB"
              style={{
                fontSize: 10, padding: "3px 8px", border: "1px solid var(--border)",
                borderRadius: 4, background: "transparent", cursor: "pointer",
                color: syncTmdb.isSuccess ? "var(--success, #27ae60)"
                     : syncTmdb.isError ? "var(--danger, #e74c3c)"
                     : "var(--text-muted)",
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
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {ownedEpisodes}/{totalEpisodes} fichiers présents
          </div>
        )}
      </div>

      {isLoading && (
        <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>Chargement…</div>
      )}

      {!isLoading && !detail?.seasons.length && (
        <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>
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
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-surface)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-main)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            &larr; Retour
          </button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {series.title}
          </span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "6px 20px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-primary)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
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
        <div style={{ overflowY: "auto", padding: 24, borderRight: "1px solid var(--border)" }}>
            <SmartPoster
              entityType="series"
              entityId={series.id}
              title={series.title}
              tmdbPosterPath={series.poster_path ?? null}
              tmdbId={series.tmdb_id}
              size="large"
              editable
            />
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              {series.first_air_date && <div>Première diffusion : {series.first_air_date}</div>}
              {series.last_air_date && <div>Dernière diffusion : {series.last_air_date}</div>}
              {series.tmdb_id && <div>TMDB : {series.tmdb_id}</div>}
              {series.imdb_id && <div>IMDb : {series.imdb_id}</div>}
              {series.tvdb_id && <div>TVDB : {series.tvdb_id}</div>}
            </div>
          </div>

        {/* Col 2: Editable fields */}
        <div style={{ overflowY: "auto", padding: 24, borderRight: "1px solid var(--border)" }}>
            <SectionTitle>Informations</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
              <UnderlineInput label="Titre" value={form.title} onChange={(v) => set("title", v)} />
              <UnderlineInput label="Titre original" value={form.original_title} onChange={(v) => set("original_title", v)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
              <UnderlineInput label="Titre de tri" value={form.sort_title} onChange={(v) => set("sort_title", v)} />
              <UnderlineInput label="Classification" value={form.content_rating} onChange={(v) => set("content_rating", v)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
              <UnderlineInput label="Première diffusion" value={form.first_air_date} onChange={(v) => set("first_air_date", v)} />
              <UnderlineInput label="Dernière diffusion" value={form.last_air_date} onChange={(v) => set("last_air_date", v)} />
            </div>

            {/* Status pills */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Statut</div>
              <div style={{ display: "flex", gap: 8 }}>
                {statuses.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => set("status", s.value)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 11,
                      border: `1px solid ${form.status === s.value ? "var(--color-primary)" : "var(--border)"}`,
                      background: form.status === s.value ? "var(--color-primary-soft)" : "transparent",
                      color: form.status === s.value ? "var(--color-primary)" : "var(--text-muted)",
                      fontWeight: form.status === s.value ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <UnderlineTextarea label="Synopsis" value={form.overview} onChange={(v) => set("overview", v)} rows={5} />
            </div>

            <div style={{ marginTop: 16 }}>
              <UnderlineTextarea label="Notes" value={form.notes} onChange={(v) => set("notes", v)} rows={3} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
              <UnderlineInput label="TMDB ID" value={form.tmdb_id} onChange={(v) => set("tmdb_id", v)} />
              <UnderlineInput label="IMDB ID" value={form.imdb_id} onChange={(v) => set("imdb_id", v)} />
              <UnderlineInput label="TVDB ID" value={form.tvdb_id} onChange={(v) => set("tvdb_id", v)} />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 16,
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: 13,
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
              <div style={{ marginTop: 24 }}>
                <SectionTitle>Images ({galleryImages.length})</SectionTitle>
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
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
                          borderRadius: 4,
                          overflow: "hidden",
                          cursor: "pointer",
                          border: "1px solid var(--border)",
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
                              background: "var(--bg-surface-alt)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--text-muted)",
                              fontSize: 9,
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
        <div style={{ overflowY: "auto", background: "var(--bg-surface-alt)" }}>
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
