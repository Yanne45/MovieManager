import { useState } from "react";
import type { Person } from "../lib/api";
import { useUpdatePerson, usePersonMovies } from "../lib/hooks";
import { tmdbImageUrl } from "../lib/api";
import { UnderlineInput, UnderlineTextarea, SectionTitle } from "../components/ui";

interface EditPersonPageProps {
  person: Person;
  onSave: () => void;
  onCancel: () => void;
}

export function EditPersonPage({ person, onSave, onCancel }: EditPersonPageProps) {
  const [form, setForm] = useState({
    name: person.name,
    primaryRole: person.primary_role ?? "",
    biography: person.biography ?? "",
    notes: person.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const updatePerson = useUpdatePerson();
  const { data: filmography = [] } = usePersonMovies(person.id);
  const photoUrl = tmdbImageUrl(person.photo_path, "w342");

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const args: Record<string, string | undefined> = { id: String(person.id) };
      if (form.name !== person.name) args.name = form.name;
      if (form.primaryRole !== (person.primary_role ?? ""))
        args.primaryRole = form.primaryRole || undefined;
      if (form.biography !== (person.biography ?? ""))
        args.biography = form.biography || undefined;
      if (form.notes !== (person.notes ?? ""))
        args.notes = form.notes || undefined;

      // Only name/primaryRole/biography/notes are updatable
      const hasChanges = Object.keys(args).length > 1; // more than just id
      if (!hasChanges) {
        onCancel();
        return;
      }

      updatePerson.mutate(
        {
          id: person.id,
          name: form.name !== person.name ? form.name : undefined,
          primaryRole: form.primaryRole !== (person.primary_role ?? "") ? form.primaryRole || undefined : undefined,
          biography: form.biography !== (person.biography ?? "") ? form.biography || undefined : undefined,
          notes: form.notes !== (person.notes ?? "") ? form.notes || undefined : undefined,
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
            {person.name}
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
          {/* Left: Photo + info */}
          <div>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={person.name}
                style={{ width: "100%", height: "auto", borderRadius: 8, marginBottom: 12 }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "2/3",
                  borderRadius: 8,
                  background: "var(--bg-surface-alt)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 12,
                }}
              >
                {person.name.split(" ").map((w) => w[0]?.toUpperCase()).join("").slice(0, 2)}
              </div>
            )}

            {/* Read-only info */}
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {person.birth_date && <div>Né(e) : {person.birth_date}</div>}
              {person.birth_place && <div>Lieu : {person.birth_place}</div>}
              {person.death_date && <div>Décès : {person.death_date}</div>}
              {person.known_for && <div>Connu(e) pour : {person.known_for}</div>}
              {person.tmdb_id && <div>TMDB : {person.tmdb_id}</div>}
              {person.imdb_id && <div>IMDb : {person.imdb_id}</div>}
            </div>
          </div>

          {/* Right: Editable fields */}
          <div>
            <SectionTitle>Informations</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
              <UnderlineInput label="Nom" value={form.name} onChange={(v) => set("name", v)} />
              <UnderlineInput label="Rôle principal" value={form.primaryRole} onChange={(v) => set("primaryRole", v)} />
            </div>

            <div style={{ marginTop: 16 }}>
              <UnderlineTextarea
                label="Biographie"
                value={form.biography}
                onChange={(v) => set("biography", v)}
                rows={6}
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

            {/* Filmography */}
            <div style={{ marginTop: 24 }}>
              <SectionTitle>Filmographie ({filmography.length})</SectionTitle>
              <div
                style={{
                  marginTop: 8,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 8,
                }}
              >
                {filmography.map((m, i) => {
                  const posterUrl = tmdbImageUrl(m.poster_path, "w92");
                  const roleLabel = m.role === "actor"
                    ? m.character_name ? `(${m.character_name})` : "(acteur)"
                    : `(${m.role})`;
                  return (
                    <div
                      key={`${m.movie_id}-${m.role}-${i}`}
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
                        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
                          {m.year ?? "—"} {roleLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filmography.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Aucun film associé</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
