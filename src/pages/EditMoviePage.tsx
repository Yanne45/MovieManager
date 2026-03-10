import { useState } from "react";
import type { Movie } from "../lib/api";
import { useUpdateMovie, useAllEntityImages, useMovieVersions } from "../lib/hooks";
import { UnderlineInput, UnderlineTextarea, SectionTitle } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import { LightboxModal } from "../components/LightboxModal";
import { convertFileSrc } from "@tauri-apps/api/core";

interface EditMoviePageProps {
  movie: Movie;
  onSave: () => void;
  onCancel: () => void;
}

export function EditMoviePage({ movie, onSave, onCancel }: EditMoviePageProps) {
  const [form, setForm] = useState({
    title: movie.title,
    original_title: movie.original_title ?? "",
    sort_title: movie.sort_title ?? "",
    overview: movie.overview ?? "",
    year: movie.year?.toString() ?? "",
    runtime: movie.runtime?.toString() ?? "",
    content_rating: movie.content_rating ?? "",
    tagline: movie.tagline ?? "",
    tmdb_id: movie.tmdb_id?.toString() ?? "",
    imdb_id: movie.imdb_id ?? "",
    notes: movie.notes ?? "",
    owned: movie.owned,
  });
  const [saving, setSaving] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const updateMovie = useUpdateMovie();
  const { data: allImages = [] } = useAllEntityImages("movie", movie.id);
  const { data: versions = [] } = useMovieVersions(movie.id);

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const input: Record<string, unknown> = {};
      if (form.title !== movie.title) input.title = form.title;
      if (form.original_title !== (movie.original_title ?? ""))
        input.original_title = form.original_title || null;
      if (form.sort_title !== (movie.sort_title ?? ""))
        input.sort_title = form.sort_title || null;
      if (form.overview !== (movie.overview ?? ""))
        input.overview = form.overview || null;
      const newYear = form.year ? parseInt(form.year) : null;
      if (newYear !== movie.year) input.year = newYear;
      const newRuntime = form.runtime ? parseInt(form.runtime) : null;
      if (newRuntime !== movie.runtime) input.runtime = newRuntime;
      if (form.content_rating !== (movie.content_rating ?? ""))
        input.content_rating = form.content_rating || null;
      if (form.tagline !== (movie.tagline ?? ""))
        input.tagline = form.tagline || null;
      if (form.notes !== (movie.notes ?? "")) input.notes = form.notes || null;
      if (form.owned !== movie.owned) input.owned = form.owned;

      if (Object.keys(input).length === 0) {
        onCancel();
        return;
      }

      updateMovie.mutate(
        { id: movie.id, input },
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

  const galleryImages = allImages.filter((img) => img.image_type !== "poster");

  // Format bitrate for display
  const fmtBitrate = (bps: number | null) => {
    if (!bps) return null;
    return bps >= 1_000_000 ? `${(bps / 1_000_000).toFixed(1)} Mbps` : `${Math.round(bps / 1000)} kbps`;
  };

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
            {movie.title}
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

      {/* Content — 3 columns: poster+tech | fields | images */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 200px", gap: 24 }}>
          {/* Left: Poster + technical info */}
          <div>
            <SmartPoster
              entityType="movie"
              entityId={movie.id}
              title={movie.title}
              tmdbPosterPath={movie.poster_path ?? null}
              tmdbId={movie.tmdb_id}
              size="large"
              editable
            />

            {/* Read-only metadata */}
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
              {movie.tmdb_id && <div>TMDB : {movie.tmdb_id}</div>}
              {movie.imdb_id && <div>IMDb : {movie.imdb_id}</div>}
            </div>

            {/* Technical versions */}
            {versions.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <SectionTitle>Technique</SectionTitle>
                {versions.map((v) => {
                  const techLine = [v.resolution, v.video_codec, v.hdr_format, v.container?.toUpperCase()].filter(Boolean).join(" · ");
                  const audioLine = [v.audio_codec, v.audio_channels ? `${v.audio_channels}ch` : null].filter(Boolean).join(" ");
                  return (
                    <div key={v.id} style={{ marginTop: 6, padding: 8, borderRadius: 6, background: "var(--bg-surface-alt)", fontSize: 10 }}>
                      {v.label && <div style={{ fontWeight: 600, marginBottom: 2 }}>{v.label}</div>}
                      {techLine && <div style={{ color: "var(--text-secondary)" }}>{techLine}</div>}
                      {audioLine && <div style={{ color: "var(--text-muted)" }}>{audioLine}</div>}
                      {v.video_bitrate && <div style={{ color: "var(--text-muted)" }}>Vidéo : {fmtBitrate(v.video_bitrate)}</div>}
                      {v.audio_bitrate && <div style={{ color: "var(--text-muted)" }}>Audio : {fmtBitrate(v.audio_bitrate)}</div>}
                      {v.duration && <div style={{ color: "var(--text-muted)" }}>Durée : {Math.round(v.duration / 60)} min</div>}
                      {v.quality_score && <div style={{ color: "var(--color-primary)", fontWeight: 500 }}>Score : {v.quality_score}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Center: Editable fields */}
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
              <UnderlineInput label="Année" value={form.year} onChange={(v) => set("year", v)} />
              <UnderlineInput label="Durée (min)" value={form.runtime} onChange={(v) => set("runtime", v)} />
            </div>

            <div style={{ marginTop: 16 }}>
              <UnderlineInput label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} />
            </div>

            <div style={{ marginTop: 16 }}>
              <UnderlineTextarea label="Synopsis" value={form.overview} onChange={(v) => set("overview", v)} rows={5} />
            </div>

            <div style={{ marginTop: 16 }}>
              <UnderlineTextarea label="Notes" value={form.notes} onChange={(v) => set("notes", v)} rows={3} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <UnderlineInput label="TMDB ID" value={form.tmdb_id} onChange={(v) => set("tmdb_id", v)} />
              <UnderlineInput label="IMDB ID" value={form.imdb_id} onChange={(v) => set("imdb_id", v)} />
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
              Film possédé (décocher pour wishlist)
            </label>
          </div>

          {/* Right: Image gallery */}
          <div>
            <SectionTitle>Images ({galleryImages.length})</SectionTitle>
            {galleryImages.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {galleryImages.map((img, i) => {
                  const thumbSrc = img.path_thumb ?? img.path_medium;
                  return (
                    <div
                      key={img.id}
                      onClick={() => setLightboxIndex(i)}
                      style={{
                        width: "100%",
                        aspectRatio: "16/10",
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
                        <div style={{
                          width: "100%", height: "100%",
                          background: "var(--bg-surface-alt)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--text-muted)", fontSize: 9,
                        }}>
                          {img.image_type}
                        </div>
                      )}
                      <div style={{
                        position: "absolute", bottom: 2, left: 4,
                        fontSize: 8, color: "rgba(255,255,255,0.7)",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                      }}>
                        {img.image_type}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
                Aucune image supplémentaire
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
