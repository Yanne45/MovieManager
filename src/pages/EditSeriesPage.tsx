import { useState } from "react";
import type { Series } from "../lib/api";
import { useUpdateSeries, useAllEntityImages } from "../lib/hooks";
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

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, maxWidth: 900 }}>
          {/* Left: Poster + read-only info */}
          <div>
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

          {/* Right: Editable fields */}
          <div>
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
