import { useState } from "react";
import type { StudioFull } from "../lib/api";
import { useUpdateStudio, useStudioMovies } from "../lib/hooks";
import { tmdbImageUrl } from "../lib/api";
import { UnderlineInput, UnderlineTextarea, SectionTitle } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import { COLORS, SP, FONT, WEIGHT, RADIUS, flex, btn } from "../lib/tokens";

interface EditStudioPageProps {
  studio: StudioFull;
  onSave: () => void;
  onCancel: () => void;
}

export function EditStudioPage({ studio, onSave, onCancel }: EditStudioPageProps) {
  const [form, setForm] = useState({
    name: studio.name,
    country: studio.country ?? "",
    description: studio.description ?? "",
    notes: studio.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const updateStudio = useUpdateStudio();
  const { data: movies = [] } = useStudioMovies(studio.id);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const hasChanges =
        form.name !== studio.name ||
        form.country !== (studio.country ?? "") ||
        form.description !== (studio.description ?? "") ||
        form.notes !== (studio.notes ?? "");

      if (!hasChanges) {
        onCancel();
        return;
      }

      updateStudio.mutate(
        {
          id: studio.id,
          name: form.name !== studio.name ? form.name : undefined,
          country: form.country !== (studio.country ?? "") ? form.country || undefined : undefined,
          description: form.description !== (studio.description ?? "") ? form.description || undefined : undefined,
          notes: form.notes !== (studio.notes ?? "") ? form.notes || undefined : undefined,
        },
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
            ← Retour
          </button>
          <span style={{ fontSize: FONT.xl, fontWeight: WEIGHT.semi }}>
            {studio.name}
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

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: SP.mega }}>
        <div style={{ maxWidth: 700, display: "grid", gridTemplateColumns: "160px 1fr", gap: SP.mega, alignItems: "start" }}>
          {/* Left: Logo */}
          <div>
            <SmartPoster
              entityType="studio"
              entityId={studio.id}
              title={studio.name}
              tmdbPosterPath={studio.logo_path ?? null}
              tmdbId={studio.tmdb_id}
              size="large"
              editable
            />
          </div>

          {/* Right: Fields */}
          <div>
          <SectionTitle>Informations</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xxxl, marginTop: SP.xl }}>
            <UnderlineInput label="Nom" value={form.name} onChange={(v) => set("name", v)} />
            <UnderlineInput label="Pays" value={form.country} onChange={(v) => set("country", v)} />
          </div>

          <div style={{ marginTop: SP.xxxl }}>
            <UnderlineTextarea
              label="Description"
              value={form.description}
              onChange={(v) => set("description", v)}
              rows={4}
            />
          </div>

          <div style={{ marginTop: SP.xxxl }}>
            <UnderlineTextarea
              label="Notes"
              value={form.notes}
              onChange={(v) => set("notes", v)}
              rows={3}
            />
          </div>

          {/* Read-only info */}
          <div style={{ marginTop: SP.xxxl, fontSize: FONT.sm, color: COLORS.textMuted }}>
            {studio.founded_date && <div>Fondé : {studio.founded_date}</div>}
            {studio.tmdb_id && <div>TMDB : {studio.tmdb_id}</div>}
          </div>

          {/* Films */}
          <div style={{ marginTop: SP.mega }}>
            <SectionTitle>Films ({movies.length})</SectionTitle>
            <div
              style={{
                marginTop: SP.base,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: SP.base,
              }}
            >
              {movies.map((m) => {
                const posterUrl = tmdbImageUrl(m.poster_path, "w92");
                return (
                  <div
                    key={m.movie_id}
                    style={{
                      ...flex.rowGap(SP.base),
                      padding: SP.m,
                      borderRadius: RADIUS.md,
                      background: COLORS.bgSurfaceAlt,
                    }}
                  >
                    {posterUrl ? (
                      <img src={posterUrl} alt="" style={{ width: 28, height: 42, objectFit: "cover", borderRadius: RADIUS.sm }} />
                    ) : (
                      <div style={{ width: 28, height: 42, borderRadius: RADIUS.sm, background: COLORS.border }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FONT.sm, fontWeight: WEIGHT.medium, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                      <div style={{ fontSize: FONT.tiny, color: COLORS.textMuted }}>{m.year ?? "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {movies.length === 0 && (
              <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.s }}>Aucun film associé</div>
            )}
          </div>
          </div> {/* right column */}
        </div>
      </div>
    </div>
  );
}
