import { useState } from "react";
import type { Person } from "../lib/api";
import { useUpdatePerson, usePersonMovies } from "../lib/hooks";
import { tmdbImageUrl } from "../lib/api";
import { UnderlineInput, UnderlineTextarea, SectionTitle } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import { COLORS, SP, FONT, WEIGHT, RADIUS, flex, btn } from "../lib/tokens";

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
            {person.name}
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
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: SP.mega, maxWidth: 900 }}>
          {/* Left: Photo + info */}
          <div>
            <SmartPoster
              entityType="person"
              entityId={person.id}
              title={person.name}
              tmdbPosterPath={person.photo_path ?? null}
              tmdbId={person.tmdb_id}
              size="large"
              editable
            />

            {/* Read-only info */}
            <div style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xxxl, marginTop: SP.xl }}>
              <UnderlineInput label="Nom" value={form.name} onChange={(v) => set("name", v)} />
              <UnderlineInput label="Rôle principal" value={form.primaryRole} onChange={(v) => set("primaryRole", v)} />
            </div>

            <div style={{ marginTop: SP.xxxl }}>
              <UnderlineTextarea
                label="Biographie"
                value={form.biography}
                onChange={(v) => set("biography", v)}
                rows={6}
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

            {/* Filmography */}
            <div style={{ marginTop: SP.mega }}>
              <SectionTitle>Filmographie ({filmography.length})</SectionTitle>
              <div
                style={{
                  marginTop: SP.base,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: SP.base,
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
                        <div style={{ fontSize: FONT.tiny, color: COLORS.textMuted }}>
                          {m.year ?? "—"} {roleLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filmography.length === 0 && (
                <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.s }}>Aucun film associé</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
