import { useState } from "react";
import type { StudioFull } from "../lib/api";
import { useUpdateStudio, useStudioMovies } from "../lib/hooks";
import { tmdbImageUrl } from "../lib/api";
import { UnderlineInput, UnderlineTextarea, SectionTitle } from "../components/ui";

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
            ← Retour
          </button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {studio.name}
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
        <div style={{ maxWidth: 700 }}>
          <SectionTitle>Informations</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            <UnderlineInput label="Nom" value={form.name} onChange={(v) => set("name", v)} />
            <UnderlineInput label="Pays" value={form.country} onChange={(v) => set("country", v)} />
          </div>

          <div style={{ marginTop: 16 }}>
            <UnderlineTextarea
              label="Description"
              value={form.description}
              onChange={(v) => set("description", v)}
              rows={4}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <UnderlineTextarea
              label="Notes"
              value={form.notes}
              onChange={(v) => set("notes", v)}
              rows={3}
            />
          </div>

          {/* Read-only info */}
          <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-muted)" }}>
            {studio.founded_date && <div>Fondé : {studio.founded_date}</div>}
            {studio.tmdb_id && <div>TMDB : {studio.tmdb_id}</div>}
          </div>

          {/* Films */}
          <div style={{ marginTop: 24 }}>
            <SectionTitle>Films ({movies.length})</SectionTitle>
            <div
              style={{
                marginTop: 8,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 8,
              }}
            >
              {movies.map((m) => {
                const posterUrl = tmdbImageUrl(m.poster_path, "w92");
                return (
                  <div
                    key={m.movie_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: 6,
                      borderRadius: 6,
                      background: "var(--bg-surface-alt)",
                    }}
                  >
                    {posterUrl ? (
                      <img src={posterUrl} alt="" style={{ width: 28, height: 42, objectFit: "cover", borderRadius: 3 }} />
                    ) : (
                      <div style={{ width: 28, height: 42, borderRadius: 3, background: "var(--border)" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{m.year ?? "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {movies.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Aucun film associé</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
