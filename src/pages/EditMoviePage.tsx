import { useState } from "react";
import type { Movie } from "../lib/api";
import { updateMovie } from "../lib/api";
import { UnderlineInput, UnderlineTextarea, TabBar, SectionTitle } from "../components/ui";

interface EditMoviePageProps {
  movie: Movie;
  onSave: (updated: Movie) => void;
  onCancel: () => void;
}

export function EditMoviePage({ movie, onSave, onCancel }: EditMoviePageProps) {
  const [tab, setTab] = useState("general");
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
      const result = await updateMovie(movie.id, input);
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
    { id: "technique", label: "Technique" },
    { id: "ids", label: "Identifiants" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-surface)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-main)" }}>
          Éditer — {movie.title}
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

      {/* Tabs */}
      <div className="px-6 pt-2">
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {tab === "general" && (
          <>
            <UnderlineInput label="Titre" value={form.title} onChange={(v) => set("title", v)} />
            <UnderlineInput
              label="Titre original"
              value={form.original_title}
              onChange={(v) => set("original_title", v)}
            />
            <UnderlineInput
              label="Titre de tri"
              value={form.sort_title}
              onChange={(v) => set("sort_title", v)}
              placeholder="Ex: Dark Knight, The"
            />
            <div className="flex gap-4">
              <div className="w-1/3">
                <UnderlineInput label="Année" value={form.year} onChange={(v) => set("year", v)} />
              </div>
              <div className="w-1/3">
                <UnderlineInput
                  label="Durée (min)"
                  value={form.runtime}
                  onChange={(v) => set("runtime", v)}
                />
              </div>
              <div className="w-1/3">
                <UnderlineInput
                  label="Classification"
                  value={form.content_rating}
                  onChange={(v) => set("content_rating", v)}
                />
              </div>
            </div>
            <UnderlineInput
              label="Tagline"
              value={form.tagline}
              onChange={(v) => set("tagline", v)}
            />
            <UnderlineTextarea
              label="Synopsis"
              value={form.overview}
              onChange={(v) => set("overview", v)}
              rows={5}
            />
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.owned}
                onChange={(e) => set("owned", e.target.checked)}
              />
              Film possédé (décocher pour wishlist)
            </label>
          </>
        )}

        {tab === "technique" && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            <SectionTitle>Informations techniques</SectionTitle>
            <p className="mt-2">Les données techniques sont extraites automatiquement par FFprobe et ne sont pas éditables manuellement.</p>
            <p className="mt-1">Score qualité actuel : <strong>{movie.primary_quality_score ?? "—"}</strong></p>
          </div>
        )}

        {tab === "ids" && (
          <>
            <UnderlineInput
              label="TMDB ID"
              value={form.tmdb_id}
              onChange={(v) => set("tmdb_id", v)}
            />
            <UnderlineInput
              label="IMDB ID"
              value={form.imdb_id}
              onChange={(v) => set("imdb_id", v)}
              placeholder="tt1234567"
            />
          </>
        )}

        {tab === "notes" && (
          <UnderlineTextarea
            label="Notes personnelles"
            value={form.notes}
            onChange={(v) => set("notes", v)}
            rows={10}
          />
        )}
      </div>
    </div>
  );
}
