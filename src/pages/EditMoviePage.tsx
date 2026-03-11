import { useState } from "react";
import type { Movie } from "../lib/api";
import { useUpdateMovie, useAllEntityImages, useMovieVersions } from "../lib/hooks";
import { UnderlineInput, UnderlineTextarea, SectionTitle } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import { LightboxModal } from "../components/LightboxModal";
import { convertFileSrc } from "@tauri-apps/api/core";
import { COLORS, SP, FONT, WEIGHT, RADIUS, flex, btn } from "../lib/tokens";

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
            {movie.title}
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

      {/* Content — 3 columns: poster+tech | fields | images */}
      <div style={{ flex: 1, overflowY: "auto", padding: SP.mega }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 200px", gap: SP.mega }}>
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
            <div style={{ marginTop: SP.lg, fontSize: FONT.sm, color: COLORS.textMuted }}>
              {movie.tmdb_id && <div>TMDB : {movie.tmdb_id}</div>}
              {movie.imdb_id && <div>IMDb : {movie.imdb_id}</div>}
            </div>

            {/* Technical versions */}
            {versions.length > 0 && (
              <div style={{ marginTop: SP.xxxl }}>
                <SectionTitle>Technique</SectionTitle>
                {versions.map((v) => {
                  const techLine = [v.resolution, v.video_codec, v.hdr_format, v.container?.toUpperCase()].filter(Boolean).join(" · ");
                  const audioLine = [v.audio_codec, v.audio_channels ? `${v.audio_channels}ch` : null].filter(Boolean).join(" ");
                  return (
                    <div key={v.id} style={{ marginTop: SP.m, padding: SP.base, borderRadius: RADIUS.md, background: COLORS.bgSurfaceAlt, fontSize: FONT.xs }}>
                      {v.label && <div style={{ fontWeight: WEIGHT.semi, marginBottom: SP.xs }}>{v.label}</div>}
                      {techLine && <div style={{ color: COLORS.textSecondary }}>{techLine}</div>}
                      {audioLine && <div style={{ color: COLORS.textMuted }}>{audioLine}</div>}
                      {v.video_bitrate && <div style={{ color: COLORS.textMuted }}>Vidéo : {fmtBitrate(v.video_bitrate)}</div>}
                      {v.audio_bitrate && <div style={{ color: COLORS.textMuted }}>Audio : {fmtBitrate(v.audio_bitrate)}</div>}
                      {v.duration && <div style={{ color: COLORS.textMuted }}>Durée : {Math.round(v.duration / 60)} min</div>}
                      {v.quality_score && <div style={{ color: COLORS.primary, fontWeight: WEIGHT.medium }}>Score : {v.quality_score}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Center: Editable fields */}
          <div>
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
              <UnderlineInput label="Année" value={form.year} onChange={(v) => set("year", v)} />
              <UnderlineInput label="Durée (min)" value={form.runtime} onChange={(v) => set("runtime", v)} />
            </div>

            <div style={{ marginTop: SP.xxxl }}>
              <UnderlineInput label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} />
            </div>

            <div style={{ marginTop: SP.xxxl }}>
              <UnderlineTextarea label="Synopsis" value={form.overview} onChange={(v) => set("overview", v)} rows={5} />
            </div>

            <div style={{ marginTop: SP.xxxl }}>
              <UnderlineTextarea label="Notes" value={form.notes} onChange={(v) => set("notes", v)} rows={3} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xxxl, marginTop: SP.xxxl }}>
              <UnderlineInput label="TMDB ID" value={form.tmdb_id} onChange={(v) => set("tmdb_id", v)} />
              <UnderlineInput label="IMDB ID" value={form.imdb_id} onChange={(v) => set("imdb_id", v)} />
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
              Film possédé (décocher pour wishlist)
            </label>
          </div>

          {/* Right: Image gallery */}
          <div>
            <SectionTitle>Images ({galleryImages.length})</SectionTitle>
            {galleryImages.length > 0 ? (
              <div style={flex.colGap(SP.m)}>
                {galleryImages.map((img, i) => {
                  const thumbSrc = img.path_thumb ?? img.path_medium;
                  return (
                    <div
                      key={img.id}
                      onClick={() => setLightboxIndex(i)}
                      style={{
                        width: "100%",
                        aspectRatio: "16/10",
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
                        <div style={{
                          width: "100%", height: "100%",
                          background: COLORS.bgSurfaceAlt,
                          ...flex.center,
                          color: COLORS.textMuted, fontSize: FONT.tiny,
                        }}>
                          {img.image_type}
                        </div>
                      )}
                      <div style={{
                        position: "absolute", bottom: SP.xs, left: SP.s,
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
              <div style={{ fontSize: FONT.xs, color: COLORS.textMuted, marginTop: SP.base }}>
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
