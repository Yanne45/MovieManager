import { useState } from "react";
import type { Series } from "../lib/api";
import { updateSeries } from "../lib/api";
import { UnderlineInput, UnderlineTextarea, TabBar } from "../components/ui";

interface EditSeriesPageProps {
  series: Series;
  onSave: (updated: Series) => void;
  onCancel: () => void;
}

export function EditSeriesPage({ series, onSave, onCancel }: EditSeriesPageProps) {
  const [tab, setTab] = useState("general");
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

      if (Object.keys(input).length === 0) { onCancel(); return; }
      const result = await updateSeries(series.id, input);
      if (result) onSave(result);
      else onCancel();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "general", label: "Général" },
    { id: "ids", label: "Identifiants" },
    { id: "notes", label: "Notes" },
  ];

  const statuses = [
    { value: "ongoing", label: "En cours" },
    { value: "ended", label: "Terminée" },
    { value: "cancelled", label: "Annulée" },
    { value: "archived", label: "Archivée" },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-surface)" }}>
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-main)" }}>
          Éditer — {series.title}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg text-sm"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm text-white"
            style={{ background: "var(--color-primary)", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      <div className="px-6 pt-2">
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {tab === "general" && (
          <>
            <UnderlineInput label="Titre" value={form.title} onChange={(v) => set("title", v)} />
            <UnderlineInput label="Titre original" value={form.original_title} onChange={(v) => set("original_title", v)} />
            <UnderlineInput label="Titre de tri" value={form.sort_title} onChange={(v) => set("sort_title", v)} />
            <div className="flex gap-4">
              <div className="w-1/3">
                <UnderlineInput label="Première diffusion" value={form.first_air_date} onChange={(v) => set("first_air_date", v)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="w-1/3">
                <UnderlineInput label="Dernière diffusion" value={form.last_air_date} onChange={(v) => set("last_air_date", v)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="w-1/3">
                <UnderlineInput label="Classification" value={form.content_rating} onChange={(v) => set("content_rating", v)} />
              </div>
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: 12, color: "var(--text-muted)" }}>Statut</label>
              <div className="flex gap-2">
                {statuses.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => set("status", s.value)}
                    className="px-3 py-1 rounded-full text-xs"
                    style={{
                      background: form.status === s.value ? "var(--color-primary-soft)" : "transparent",
                      color: form.status === s.value ? "var(--color-primary)" : "var(--text-muted)",
                      border: `1px solid ${form.status === s.value ? "var(--color-primary)" : "var(--border)"}`,
                      fontWeight: form.status === s.value ? 600 : 400,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <UnderlineTextarea label="Synopsis" value={form.overview} onChange={(v) => set("overview", v)} rows={5} />
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              <input type="checkbox" checked={form.owned} onChange={(e) => set("owned", e.target.checked)} />
              Série possédée (décocher pour wishlist)
            </label>
          </>
        )}

        {tab === "ids" && (
          <>
            <UnderlineInput label="TMDB ID" value={form.tmdb_id} onChange={(v) => set("tmdb_id", v)} />
            <UnderlineInput label="IMDB ID" value={form.imdb_id} onChange={(v) => set("imdb_id", v)} placeholder="tt1234567" />
            <UnderlineInput label="TVDB ID" value={form.tvdb_id} onChange={(v) => set("tvdb_id", v)} />
          </>
        )}

        {tab === "notes" && (
          <UnderlineTextarea label="Notes personnelles" value={form.notes} onChange={(v) => set("notes", v)} rows={10} />
        )}
      </div>
    </div>
  );
}
