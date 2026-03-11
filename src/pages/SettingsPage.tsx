import { useState } from "react";
import { TabBar, UnderlineInput, SectionTitle } from "../components/ui";
import type { Library, ScoreWeights } from "../lib/api";
import { DEFAULT_SCORE_WEIGHTS } from "../lib/api";
import {
  useFfprobeStatus, useSeedDemoData,
  useGenres, useCreateGenre, useUpdateGenre, useDeleteGenre,
  useScoreWeights, useSetScoreWeights, useRecomputeAllScores,
} from "../lib/hooks";
import { COLORS, SP, FONT, WEIGHT, RADIUS, flex, btn, card, input } from "../lib/tokens";

export interface RecentDatabase {
  path: string;
  name: string;
  last_opened: string;
}

interface SettingsPageProps {
  libraries: Library[];
  onScanLibrary?: (id: number) => void;
  onCreateLibrary?: () => void;
  onSetTmdbKey?: (key: string) => void;
  // Multi-database
  currentDbName?: string;
  currentDbPath?: string;
  recentDatabases?: RecentDatabase[];
  onOpenDatabase?: (path: string) => void;
  onCreateDatabase?: () => void;
  // Backup
  onBackup?: () => void;
  // NFO import
  onImportNfo?: () => void;
  // Export
  onExportJson?: () => void;
  onExportCsv?: () => void;
}

export function SettingsPage({
  libraries,
  onScanLibrary,
  onCreateLibrary,
  onSetTmdbKey,
  currentDbName,
  currentDbPath,
  recentDatabases = [],
  onOpenDatabase,
  onCreateDatabase,
  onBackup,
  onImportNfo,
  onExportJson,
  onExportCsv,
}: SettingsPageProps) {
  const [tab, setTab] = useState("database");
  const [tmdbKey, setTmdbKey] = useState("");

  return (
    <div style={{ flex: 1, ...flex.col, overflow: "hidden" }}>
      <TabBar
        tabs={[
          { id: "database", label: "Base de données" },
          { id: "libraries", label: "Libraries" },
          { id: "genres", label: "Genres" },
          { id: "api", label: "API Keys" },
          { id: "general", label: "Général" },
          { id: "score", label: "Score qualité" },
          { id: "about", label: "À propos" },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: `${SP.huge}px ${SP.mega}px` }}>
        {tab === "database" && (
          <DatabaseTab
            currentName={currentDbName}
            currentPath={currentDbPath}
            recentDatabases={recentDatabases}
            onOpen={onOpenDatabase}
            onCreate={onCreateDatabase}
            onBackup={onBackup}
            onExportJson={onExportJson}
            onExportCsv={onExportCsv}
          />
        )}
        {tab === "libraries" && (
          <LibrariesTab
            libraries={libraries}
            onScan={onScanLibrary}
            onCreate={onCreateLibrary}
            onImportNfo={onImportNfo}
          />
        )}
        {tab === "genres" && <GenresTab />}
        {tab === "api" && (
          <ApiKeysTab tmdbKey={tmdbKey} onChange={setTmdbKey} onSave={onSetTmdbKey} />
        )}
        {tab === "general" && <GeneralTab />}
        {tab === "score" && <ScoreTab />}
        {tab === "about" && <AboutTab />}
      </div>
    </div>
  );
}

function LibrariesTab({
  libraries,
  onScan,
  onCreate,
  onImportNfo,
}: {
  libraries: Library[];
  onScan?: (id: number) => void;
  onCreate?: () => void;
  onImportNfo?: () => void;
}) {
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ ...flex.rowBetween, marginBottom: SP.xxxl }}>
        <SectionTitle>Sources physiques</SectionTitle>
        <div style={flex.rowGap(SP.base)}>
          <button
            onClick={onImportNfo}
            style={{
              ...btn.base,
              background: "transparent",
              color: COLORS.textSecondary,
            }}
          >
            Import NFO
          </button>
          <button
            onClick={onCreate}
            style={btn.primary}
          >
            + Ajouter une library
          </button>
        </div>
      </div>

      {libraries.map((lib) => (
        <div
          key={lib.id}
          style={{
            ...card.base,
            padding: SP.xxxl,
            marginBottom: SP.lg,
          }}
        >
          <div style={{ ...flex.rowGap(SP.lg), marginBottom: SP.base }}>
            <span style={{ fontSize: FONT.lg, fontWeight: WEIGHT.semi }}>{lib.name}</span>
            <span
              style={{
                fontSize: FONT.xs,
                fontWeight: WEIGHT.semi,
                padding: `${SP.xs}px ${SP.base}px`,
                borderRadius: RADIUS.sm,
                textTransform: "uppercase",
                background:
                  lib.lib_type === "nas"
                    ? COLORS.primarySoft
                    : COLORS.bgSurfaceAlt,
                color:
                  lib.lib_type === "nas" ? COLORS.primary : COLORS.textMuted,
              }}
            >
              {lib.lib_type}
            </span>
            <span
              style={{
                ...flex.rowGap(SP.s),
                marginLeft: "auto",
                fontSize: FONT.sm,
                fontWeight: WEIGHT.medium,
                color: lib.is_online ? COLORS.success : COLORS.error,
              }}
            >
              <span style={{ fontSize: 8 }}>●</span>
              {lib.is_online ? "En ligne" : "Hors ligne"}
            </span>
          </div>
          <div
            style={{
              fontSize: FONT.base,
              color: COLORS.textSecondary,
              display: "grid",
              gridTemplateColumns: "90px 1fr",
              rowGap: SP.s,
            }}
          >
            <span style={{ color: COLORS.textMuted }}>Chemin</span>
            <span style={{ fontFamily: "monospace", fontSize: FONT.sm }}>{lib.path}</span>
            <span style={{ color: COLORS.textMuted }}>Fichiers</span>
            <span>{lib.total_files}</span>
            <span style={{ color: COLORS.textMuted }}>Dernier scan</span>
            <span>{lib.last_scan || "Jamais"}</span>
          </div>
          <div style={{ ...flex.rowGap(SP.base), marginTop: SP.xl }}>
            <button
              onClick={() => onScan?.(lib.id)}
              style={{
                ...btn.base,
                padding: `${SP.s + 1}px ${SP.xl}px`,
                background: "transparent",
                color: COLORS.textSecondary,
                fontWeight: WEIGHT.medium,
              }}
            >
              Scanner
            </button>
          </div>
        </div>
      ))}

      {libraries.length === 0 && (
        <p style={{ color: COLORS.textMuted, fontSize: FONT.md }}>
          Aucune library configurée. Ajoutez un dossier pour commencer.
        </p>
      )}
    </div>
  );
}

function ApiKeysTab({
  tmdbKey,
  onChange,
  onSave,
}: {
  tmdbKey: string;
  onChange: (v: string) => void;
  onSave?: (key: string) => void;
}) {
  return (
    <div style={{ maxWidth: 500 }}>
      <SectionTitle>Clés API pour le matching automatique</SectionTitle>
      <div style={{ marginTop: SP.xxl }}>
        <UnderlineInput label="TMDB API Key" value={tmdbKey} onChange={onChange} />
        <button
          onClick={() => onSave?.(tmdbKey)}
          style={btn.primary}
        >
          Valider
        </button>
      </div>
      <p style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.base }}>
        Obtenez une clé API gratuite sur themoviedb.org
      </p>
    </div>
  );
}

function GeneralTab() {
  return (
    <div style={{ maxWidth: 500 }}>
      {/* FFprobe status */}
      <FfprobeStatusPanel />

      <div style={{ marginTop: SP.mega }}>
        <SectionTitle>Préférences</SectionTitle>
        {[
          { label: "Langue des métadonnées", desc: "Langue préférée pour titres et synopsis", value: "Français" },
          { label: "Scan automatique au démarrage", desc: "Scan différentiel de toutes les libraries", value: "Activé" },
          { label: "Matching automatique TMDB", desc: "Rechercher les métadonnées après un scan", value: "Activé" },
          { label: "Seuil de confiance matching", desc: "En dessous, envoi dans l'inbox", value: "70%" },
        ].map((pref) => (
          <div
            key={pref.label}
            style={{
              ...flex.rowBetween,
              padding: `${SP.xl}px 0`,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <div>
              <div style={{ fontSize: FONT.md, fontWeight: WEIGHT.medium }}>{pref.label}</div>
              <div style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>{pref.desc}</div>
            </div>
            <span
              style={{
                fontSize: FONT.md,
                color: COLORS.textSecondary,
                padding: `${SP.s}px ${SP.xl}px`,
                background: COLORS.bgSurfaceAlt,
                borderRadius: RADIUS.md,
              }}
            >
              {pref.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatabaseTab({
  currentName,
  currentPath,
  recentDatabases,
  onOpen,
  onCreate,
  onBackup,
  onExportJson,
  onExportCsv,
}: {
  currentName?: string;
  currentPath?: string;
  recentDatabases: RecentDatabase[];
  onOpen?: (path: string) => void;
  onCreate?: () => void;
  onBackup?: () => void;
  onExportJson?: () => void;
  onExportCsv?: () => void;
}) {
  const seedMutation = useSeedDemoData();
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const handleSeedDemo = () => {
    if (!confirm("Cela va insérer des données de démo dans la base actuelle. Continuer ?")) return;
    setSeedMessage(null);
    seedMutation.mutate(undefined, {
      onSuccess: (summary) => setSeedMessage(summary),
      onError: (err) => setSeedMessage(`Erreur : ${err}`),
    });
  };

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Current database */}
      <SectionTitle>Base de données active</SectionTitle>
      <div
        style={{
          padding: SP.xxxl,
          marginBottom: SP.huge,
          borderRadius: RADIUS.lg,
          border: `2px solid ${COLORS.primary}`,
          background: COLORS.bgSurface,
        }}
      >
        <div style={{ ...flex.rowGap(SP.lg), marginBottom: SP.m }}>
          <span style={{ fontSize: 8, color: COLORS.success }}>●</span>
          <span style={{ fontSize: 15, fontWeight: WEIGHT.semi }}>{currentName || "moviemanager"}</span>
        </div>
        <div
          style={{
            fontSize: FONT.sm,
            fontFamily: "monospace",
            color: COLORS.textMuted,
            wordBreak: "break-all",
          }}
        >
          {currentPath || "Chemin par défaut"}
        </div>
      </div>

      {/* Actions */}
      <div style={{ ...flex.rowGap(SP.base), marginBottom: SP.mega }}>
        <button onClick={onCreate} style={btn.primary}>
          Nouvelle base
        </button>
        <button
          onClick={() => onOpen?.("")}
          style={{
            ...btn.base,
            padding: `${SP.base}px ${SP.xxxl}px`,
            background: "transparent",
            color: COLORS.textSecondary,
            fontWeight: WEIGHT.medium,
          }}
        >
          Ouvrir un fichier .db
        </button>
        <button
          onClick={onBackup}
          style={{
            ...btn.base,
            padding: `${SP.base}px ${SP.xxxl}px`,
            background: "transparent",
            color: COLORS.textSecondary,
            fontWeight: WEIGHT.medium,
          }}
        >
          Sauvegarder (ZIP)
        </button>
        <button
          onClick={onExportJson}
          style={{
            ...btn.base,
            padding: `${SP.base}px ${SP.xxxl}px`,
            background: "transparent",
            color: COLORS.textSecondary,
            fontWeight: WEIGHT.medium,
          }}
        >
          Export JSON
        </button>
        <button
          onClick={onExportCsv}
          style={{
            ...btn.base,
            padding: `${SP.base}px ${SP.xxxl}px`,
            background: "transparent",
            color: COLORS.textSecondary,
            fontWeight: WEIGHT.medium,
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Demo data */}
      <SectionTitle>Données de test</SectionTitle>
      <div style={{ marginBottom: SP.mega }}>
        <div style={flex.rowGap(SP.xl)}>
          <button
            onClick={handleSeedDemo}
            disabled={seedMutation.isPending}
            style={{
              ...btn.base,
              padding: `${SP.base}px ${SP.xxxl}px`,
              background: "transparent",
              color: COLORS.textSecondary,
              fontWeight: WEIGHT.medium,
              cursor: seedMutation.isPending ? "wait" : "pointer",
              opacity: seedMutation.isPending ? 0.6 : 1,
            }}
          >
            {seedMutation.isPending ? "Insertion en cours..." : "Charger données de démo"}
          </button>
          <span style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
            Insère films, séries, personnes, tags, règles, etc. pour tester toutes les pages.
          </span>
        </div>
        {seedMessage && (
          <div
            style={{
              marginTop: SP.lg,
              padding: `${SP.lg}px ${SP.xxl}px`,
              borderRadius: RADIUS.md,
              fontSize: FONT.base,
              background: seedMutation.isError ? "var(--score-d-bg)" : "var(--score-a-bg)",
              color: seedMutation.isError ? "var(--score-d-text)" : "var(--score-a-text)",
              border: `1px solid ${seedMutation.isError ? COLORS.error : COLORS.success}`,
            }}
          >
            {seedMessage}
          </div>
        )}
      </div>

      {/* Recent databases */}
      <SectionTitle>Bases récentes</SectionTitle>
      {recentDatabases.length === 0 ? (
        <p style={{ fontSize: FONT.base, color: COLORS.textMuted }}>Aucune base récente</p>
      ) : (
        <div style={{ marginTop: SP.base }}>
          {recentDatabases.map((db, i) => {
            const isActive = db.path === currentPath;
            return (
              <div
                key={i}
                onClick={() => !isActive && onOpen?.(db.path)}
                style={{
                  ...flex.rowGap(SP.lg),
                  padding: `${SP.lg}px ${SP.xxl}px`,
                  marginBottom: SP.m,
                  borderRadius: RADIUS.lg,
                  border: isActive ? `1px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                  background: isActive ? COLORS.primarySoft : COLORS.bgSurface,
                  cursor: isActive ? "default" : "pointer",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FONT.md, fontWeight: WEIGHT.medium }}>
                    {db.name}
                    {isActive && (
                      <span style={{ fontSize: FONT.xs, color: COLORS.primary, marginLeft: SP.base }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: FONT.xs,
                      fontFamily: "monospace",
                      color: COLORS.textMuted,
                      marginTop: SP.xs,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {db.path}
                  </div>
                </div>
                <span style={{ fontSize: FONT.xs, color: COLORS.textMuted, flexShrink: 0 }}>
                  {db.last_opened}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Genres Tab
// ============================================================================

function GenresTab() {
  const { data: genres = [], isLoading } = useGenres();
  const createGenre = useCreateGenre();
  const updateGenre = useUpdateGenre();
  const deleteGenre = useDeleteGenre();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createGenre.mutate({ name: trimmed }, { onSuccess: () => setNewName("") });
  };

  const startEdit = (id: number, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const confirmEdit = () => {
    if (editingId === null) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    updateGenre.mutate({ id: editingId, name: trimmed }, {
      onSuccess: () => { setEditingId(null); setEditingName(""); },
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Supprimer le genre "${name}" ? Il sera retiré de tous les films/séries associés.`)) return;
    deleteGenre.mutate(id);
  };

  const btnStyle = (variant: "primary" | "ghost" | "danger"): React.CSSProperties => ({
    ...(variant === "primary" ? btn.primary : btn.base),
    padding: `${SP.s + 1}px ${SP.xl}px`,
    background: variant === "primary" ? COLORS.primary : "transparent",
    color: variant === "primary" ? "#fff" : variant === "danger" ? COLORS.error : COLORS.textSecondary,
    border: variant === "primary" ? "none" : `1px solid ${COLORS.border}`,
    fontWeight: variant === "primary" ? WEIGHT.semi : WEIGHT.medium,
  });

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle>Genres disponibles</SectionTitle>
      <p style={{ fontSize: FONT.base, color: COLORS.textMuted, marginBottom: SP.xxxl }}>
        Liste des genres utilisés pour classifier films et séries. Modifiez ou supprimez en toute sécurité — les genres TMDB sont recréés automatiquement lors des imports.
      </p>

      {/* Add genre */}
      <div style={{ ...flex.rowGap(SP.base), marginBottom: SP.huge }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Nouveau genre…"
          style={{
            ...input.base,
            flex: 1,
            padding: `7px ${SP.xl}px`,
            fontSize: FONT.md,
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || createGenre.isPending}
          style={btnStyle("primary")}
        >
          {createGenre.isPending ? "…" : "+ Ajouter"}
        </button>
      </div>

      {/* Genre list */}
      {isLoading ? (
        <p style={{ fontSize: FONT.base, color: COLORS.textMuted }}>Chargement…</p>
      ) : genres.length === 0 ? (
        <p style={{ fontSize: FONT.base, color: COLORS.textMuted }}>Aucun genre enregistré.</p>
      ) : (
        <div style={flex.colGap(SP.s)}>
          {genres.map((g) => (
            <div
              key={g.id}
              style={{
                ...flex.rowGap(SP.base),
                padding: `${SP.base}px ${SP.xl}px`,
                borderRadius: RADIUS.lg,
                border: `1px solid ${COLORS.border}`,
                background: editingId === g.id ? COLORS.primarySoft : COLORS.bgSurface,
              }}
            >
              {editingId === g.id ? (
                <>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    style={{
                      ...input.base,
                      flex: 1,
                      padding: `${SP.s}px ${SP.base}px`,
                      borderRadius: 5,
                      border: `1px solid ${COLORS.primary}`,
                      fontSize: FONT.md,
                    }}
                  />
                  <button onClick={confirmEdit} style={btnStyle("primary")}>OK</button>
                  <button onClick={() => setEditingId(null)} style={btnStyle("ghost")}>Annuler</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: FONT.md, fontWeight: WEIGHT.medium }}>{g.name}</span>
                  {g.tmdb_id && (
                    <span style={{ fontSize: FONT.xs, color: COLORS.textMuted, fontFamily: "monospace" }}>
                      TMDB #{g.tmdb_id}
                    </span>
                  )}
                  <button onClick={() => startEdit(g.id, g.name)} style={btnStyle("ghost")}>Renommer</button>
                  <button onClick={() => handleDelete(g.id, g.name)} style={btnStyle("danger")}>Supprimer</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.xxxl }}>
        {genres.length} genre{genres.length !== 1 ? "s" : ""} au total
      </p>
    </div>
  );
}

// ============================================================================
// Score qualité Tab
// ============================================================================

const GRADE_INFO = [
  { grade: "A", color: "var(--score-a-text)", bg: "var(--score-a-bg)", label: "Excellent", pct: 71 },
  { grade: "B", color: "var(--score-b-text)", bg: "var(--score-b-bg)", label: "Bon",       pct: 48 },
  { grade: "C", color: "var(--score-c-text)", bg: "var(--score-c-bg)", label: "Correct",   pct: 29 },
  { grade: "D", color: "var(--score-d-text)", bg: "var(--score-d-bg)", label: "Faible",    pct: 0  },
];

const CRITERIA: Array<{ key: keyof ScoreWeights; label: string; detail: string }> = [
  { key: "resolution",     label: "Résolution vidéo",        detail: "4K=100%, 1080p=70%, 720p=40%, 480p=15%" },
  { key: "codec",          label: "Codec vidéo",             detail: "HEVC/AV1=100%, VP9=70%, H.264=60%, MPEG-2=20%" },
  { key: "bitrate",        label: "Bitrate vidéo",           detail: "Normalisé par résolution (4K ≥15 Mbps = 100%)" },
  { key: "audio_channels", label: "Audio — canaux",          detail: "7.1=100%, 5.1=80%, Stéréo=40%, Mono=20%" },
  { key: "audio_lossless", label: "Audio — codec lossless",  detail: "TrueHD / DTS-HD MA / FLAC / PCM : bonus fixe" },
  { key: "hdr",            label: "HDR",                     detail: "HDR10, HLG ou variante détectée : bonus fixe" },
];

function ScoreTab() {
  const { data: saved, isLoading } = useScoreWeights();
  const setWeights = useSetScoreWeights();
  const recompute = useRecomputeAllScores();

  // Local draft state — initialised once saved weights arrive
  const [draft, setDraft] = useState<ScoreWeights | null>(null);

  // Merge saved into draft on first load (or when saved changes and draft is still null)
  const weights: ScoreWeights = draft ?? saved ?? DEFAULT_SCORE_WEIGHTS;

  const totalMax = (Object.values(weights) as number[]).reduce((a, b) => a + b, 0);
  const isDirty = draft !== null;

  const handleChange = (key: keyof ScoreWeights, value: number) => {
    setDraft({ ...(draft ?? saved ?? DEFAULT_SCORE_WEIGHTS), [key]: value });
  };

  const handleReset = () => setDraft({ ...DEFAULT_SCORE_WEIGHTS });

  const handleSave = () => {
    setWeights.mutate(weights, {
      onSuccess: () => setDraft(null),
    });
  };

  const handleRecompute = () => recompute.mutate();

  if (isLoading) {
    return <div style={{ padding: SP.huge, color: COLORS.textMuted, fontSize: FONT.md }}>Chargement…</div>;
  }

  return (
    <div style={{ maxWidth: 660 }}>
      <SectionTitle>Score qualité — poids des critères</SectionTitle>
      <p style={{ fontSize: FONT.base, color: COLORS.textMuted, marginBottom: SP.huge, lineHeight: 1.6 }}>
        Ajustez le nombre maximum de points attribués à chaque critère. Le total des points
        s'adapte automatiquement. Les seuils de notation restent proportionnels
        (A ≥ 71 %, B ≥ 48 %, C ≥ 29 % du total maximum).
      </p>

      {/* Grade thresholds preview */}
      <div style={{ display: "flex", gap: SP.base, marginBottom: SP.mega, flexWrap: "wrap" }}>
        {GRADE_INFO.map((g) => {
          const minPts = Math.ceil(totalMax * g.pct / 100);
          return (
            <div
              key={g.grade}
              style={{
                flex: "1 1 100px",
                padding: `${SP.lg}px ${SP.xl}px`,
                borderRadius: RADIUS.lg,
                background: g.bg,
                border: `1px solid ${g.color}33`,
              }}
            >
              <div style={{ ...flex.rowGap(SP.m), marginBottom: RADIUS.sm }}>
                <span style={{
                  fontSize: FONT.xl, fontWeight: WEIGHT.bold, color: g.color,
                  width: 26, height: 26, ...flex.center,
                  borderRadius: 5, background: `${g.color}22`,
                }}>
                  {g.grade}
                </span>
                <span style={{ fontSize: FONT.base, fontWeight: WEIGHT.semi, color: g.color }}>{g.label}</span>
              </div>
              <div style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
                {g.pct > 0 ? `≥ ${minPts} / ${totalMax} pts` : `< ${Math.ceil(totalMax * 0.29 / 100)} pts`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sliders */}
      <div style={{ ...flex.colGap(SP.xl), marginBottom: SP.mega }}>
        {CRITERIA.map(({ key, label, detail }) => {
          const val = weights[key];
          const pct = totalMax > 0 ? Math.round(val / totalMax * 100) : 0;
          return (
            <div
              key={key}
              style={{
                ...card.base,
                padding: `${SP.xl}px ${SP.xxxl}px`,
              }}
            >
              <div style={{ ...flex.rowBetween, marginBottom: SP.m }}>
                <div>
                  <span style={{ fontSize: FONT.md, fontWeight: WEIGHT.semi }}>{label}</span>
                  <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.xs }}>{detail}</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 80 }}>
                  <span style={{
                    fontSize: FONT.xxl, fontWeight: WEIGHT.bold, color: COLORS.primary,
                  }}>{val}</span>
                  <span style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginLeft: SP.s }}>pts</span>
                  <div style={{ fontSize: FONT.xs, color: COLORS.textMuted }}>{pct}% du total</div>
                </div>
              </div>
              <div style={flex.rowGap(SP.lg)}>
                <span style={{ fontSize: FONT.xs, color: COLORS.textMuted, minWidth: SP.lg }}>0</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={val}
                  onChange={(e) => handleChange(key, Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--color-primary)" }}
                />
                <span style={{ fontSize: FONT.xs, color: COLORS.textMuted, minWidth: SP.mega }}>100</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total indicator */}
      <div style={{
        ...flex.rowBetween,
        padding: `${SP.lg}px ${SP.xxxl}px`,
        borderRadius: RADIUS.lg,
        background: COLORS.bgSurfaceAlt,
        border: `1px solid ${COLORS.border}`,
        marginBottom: SP.huge,
      }}>
        <span style={{ fontSize: FONT.md, fontWeight: WEIGHT.semi }}>Total maximum</span>
        <span style={{ fontSize: FONT.xxl, fontWeight: WEIGHT.bold, color: COLORS.primary }}>
          {totalMax} pts
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: SP.lg, flexWrap: "wrap" }}>
        <button
          onClick={handleReset}
          disabled={!isDirty}
          style={{
            ...btn.base,
            padding: `${SP.base}px ${SP.xxxl}px`,
            fontSize: FONT.md,
            fontWeight: WEIGHT.semi,
            background: COLORS.bgSurface,
            color: COLORS.textSecondary,
            cursor: isDirty ? "pointer" : "not-allowed",
            opacity: isDirty ? 1 : 0.5,
          }}
        >
          Réinitialiser
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || setWeights.isPending}
          style={{
            ...btn.primary,
            padding: `${SP.base}px ${SP.xxxl}px`,
            fontSize: FONT.md,
            cursor: isDirty && !setWeights.isPending ? "pointer" : "not-allowed",
            opacity: isDirty && !setWeights.isPending ? 1 : 0.5,
          }}
        >
          {setWeights.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          onClick={handleRecompute}
          disabled={recompute.isPending || isDirty}
          title={isDirty ? "Enregistrez d'abord les nouvelles valeurs" : "Recalcule tous les scores avec les poids actuels"}
          style={{
            ...btn.base,
            padding: `${SP.base}px ${SP.xxxl}px`,
            fontSize: FONT.md,
            fontWeight: WEIGHT.semi,
            border: `1px solid ${COLORS.primary}`,
            background: "transparent",
            color: COLORS.primary,
            cursor: !recompute.isPending && !isDirty ? "pointer" : "not-allowed",
            opacity: !recompute.isPending && !isDirty ? 1 : 0.5,
          }}
        >
          {recompute.isPending ? "Recalcul en cours…" : "Recalculer tous les films"}
        </button>
      </div>

      {recompute.isSuccess && (
        <div style={{ marginTop: SP.xl, fontSize: FONT.base, color: COLORS.success }}>
          {recompute.data} version{(recompute.data ?? 0) > 1 ? "s" : ""} mise{(recompute.data ?? 0) > 1 ? "s" : ""} à jour.
        </div>
      )}
      {setWeights.isSuccess && !isDirty && (
        <div style={{ marginTop: SP.xl, fontSize: FONT.base, color: COLORS.success }}>
          Poids enregistrés. Cliquez sur "Recalculer tous les films" pour appliquer.
        </div>
      )}
      {(setWeights.isError || recompute.isError) && (
        <div style={{ marginTop: SP.xl, fontSize: FONT.base, color: "var(--error, #e74c3c)" }}>
          Erreur : {String((setWeights.error || recompute.error) ?? "inconnu")}
        </div>
      )}

      <p style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.huge, lineHeight: 1.5 }}>
        Le score est calculé lors de l'analyse FFprobe de chaque fichier, et peut être recalculé
        à tout moment sans relancer FFprobe en utilisant les données techniques déjà stockées.
      </p>
    </div>
  );
}

function AboutTab() {
  return (
    <div style={{ maxWidth: 400 }}>
      <div style={{ fontSize: 22, fontWeight: WEIGHT.semi, marginBottom: SP.s }}>MovieManager</div>
      <div style={{ fontSize: FONT.md, color: COLORS.textMuted, marginBottom: SP.xxxl }}>Version 0.1.0 — MVP</div>
      <p style={{ fontSize: FONT.md, color: COLORS.textSecondary, lineHeight: 1.55, marginBottom: SP.xxxl }}>
        Application desktop de gestion de collection de fichiers vidéo. Cataloguez, organisez,
        enrichissez et maintenez votre collection de films et séries TV.
      </p>
      <div style={{ fontSize: FONT.base, color: COLORS.textMuted }}>Tauri 2 + React + SQLite</div>
    </div>
  );
}

// ============================================================================
// FFprobe Status Panel
// ============================================================================

function FfprobeStatusPanel() {
  const { data: status, isLoading, refetch } = useFfprobeStatus();

  if (isLoading) {
    return (
      <div style={{ ...card.base, padding: SP.xxxl }}>
        <SectionTitle>FFprobe</SectionTitle>
        <p style={{ fontSize: FONT.base, color: COLORS.textMuted }}>Vérification en cours…</p>
      </div>
    );
  }

  const available = status?.available ?? false;

  return (
    <div
      style={{
        padding: SP.xxxl,
        borderRadius: RADIUS.lg,
        border: available ? `1px solid ${COLORS.border}` : `2px solid ${COLORS.warning}`,
        background: available ? COLORS.bgSurface : "var(--score-c-bg)",
      }}
    >
      <div style={{ ...flex.rowGap(SP.lg), marginBottom: SP.lg }}>
        <SectionTitle>FFprobe / FFmpeg</SectionTitle>
        <span
          style={{
            fontSize: FONT.xs,
            fontWeight: WEIGHT.semi,
            padding: `${SP.xs}px ${SP.base}px`,
            borderRadius: RADIUS.sm,
            background: available ? "var(--score-a-bg)" : "var(--score-d-bg)",
            color: available ? "var(--score-a-text)" : "var(--score-d-text)",
          }}
        >
          {available ? "Détecté" : "Non trouvé"}
        </span>
      </div>

      {available ? (
        <div style={{ fontSize: FONT.base, color: COLORS.textSecondary }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr",
              rowGap: SP.s,
            }}
          >
            <span style={{ color: COLORS.textMuted }}>Version</span>
            <span>{status?.version ?? "inconnue"}</span>
            <span style={{ color: COLORS.textMuted }}>Chemin</span>
            <span style={{ fontFamily: "monospace", fontSize: FONT.sm }}>{status?.path ?? "PATH système"}</span>
          </div>
          <p style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.base }}>
            L'analyse technique des fichiers vidéo (codec, résolution, bitrate, audio) est active.
          </p>
        </div>
      ) : (
        <div style={{ fontSize: FONT.base, color: COLORS.textSecondary }}>
          <p style={{ marginBottom: SP.base }}>
            FFprobe est nécessaire pour analyser les fichiers vidéo (codec, résolution, bitrate, canaux audio).
            Sans FFprobe, le scan fonctionne mais les métadonnées techniques ne seront pas extraites.
          </p>
          <p style={{ fontWeight: WEIGHT.medium, marginBottom: SP.base }}>
            Installation recommandée :
          </p>
          <div style={{ fontSize: FONT.sm, padding: `${SP.base}px ${SP.xl}px`, borderRadius: RADIUS.md, background: COLORS.bgSurface, border: `1px solid ${COLORS.border}`, marginBottom: SP.base }}>
            <div style={{ marginBottom: SP.s }}>
              <span style={{ fontWeight: WEIGHT.semi }}>Windows : </span>
              <span style={{ color: COLORS.textMuted }}>
                Téléchargez FFmpeg depuis ffmpeg.org/download.html et ajoutez le dossier bin au PATH système.
              </span>
            </div>
            <div style={{ marginBottom: SP.s }}>
              <span style={{ fontWeight: WEIGHT.semi }}>macOS : </span>
              <span style={{ fontFamily: "monospace", color: COLORS.textMuted }}>brew install ffmpeg</span>
            </div>
            <div>
              <span style={{ fontWeight: WEIGHT.semi }}>Linux : </span>
              <span style={{ fontFamily: "monospace", color: COLORS.textMuted }}>sudo apt install ffmpeg</span>
            </div>
          </div>
          {status?.error && (
            <p style={{ fontSize: FONT.xs, color: COLORS.textMuted, fontFamily: "monospace" }}>
              {status.error}
            </p>
          )}
          <button
            onClick={() => refetch()}
            style={{
              ...btn.base,
              padding: `${SP.s + 1}px ${SP.xxl}px`,
              background: "transparent",
              color: COLORS.textSecondary,
              fontWeight: WEIGHT.medium,
              marginTop: SP.s,
            }}
          >
            Revérifier
          </button>
        </div>
      )}
    </div>
  );
}
