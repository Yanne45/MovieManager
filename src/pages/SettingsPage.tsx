import { useState } from "react";
import { TabBar, UnderlineInput, SectionTitle } from "../components/ui";
import type { Library, ScoreWeights } from "../lib/api";
import { DEFAULT_SCORE_WEIGHTS } from "../lib/api";
import {
  useFfprobeStatus, useSeedDemoData,
  useGenres, useCreateGenre, useUpdateGenre, useDeleteGenre,
  useScoreWeights, useSetScoreWeights, useRecomputeAllScores,
} from "../lib/hooks";

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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionTitle>Sources physiques</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onImportNfo}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Import NFO
          </button>
          <button
            onClick={onCreate}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--color-primary)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Ajouter une library
          </button>
        </div>
      </div>

      {libraries.map((lib) => (
        <div
          key={lib.id}
          style={{
            padding: 16,
            marginBottom: 10,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{lib.name}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                textTransform: "uppercase",
                background:
                  lib.lib_type === "nas"
                    ? "var(--color-primary-soft)"
                    : "var(--bg-surface-alt)",
                color:
                  lib.lib_type === "nas" ? "var(--color-primary)" : "var(--text-muted)",
              }}
            >
              {lib.lib_type}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginLeft: "auto",
                fontSize: 11,
                fontWeight: 500,
                color: lib.is_online ? "var(--success)" : "var(--error)",
              }}
            >
              <span style={{ fontSize: 8 }}>●</span>
              {lib.is_online ? "En ligne" : "Hors ligne"}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              display: "grid",
              gridTemplateColumns: "90px 1fr",
              rowGap: 4,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Chemin</span>
            <span style={{ fontFamily: "monospace", fontSize: 11 }}>{lib.path}</span>
            <span style={{ color: "var(--text-muted)" }}>Fichiers</span>
            <span>{lib.total_files}</span>
            <span style={{ color: "var(--text-muted)" }}>Dernier scan</span>
            <span>{lib.last_scan || "Jamais"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => onScan?.(lib.id)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Scanner
            </button>
          </div>
        </div>
      ))}

      {libraries.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
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
      <div style={{ marginTop: 14 }}>
        <UnderlineInput label="TMDB API Key" value={tmdbKey} onChange={onChange} />
        <button
          onClick={() => onSave?.(tmdbKey)}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-primary)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Valider
        </button>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
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

      <div style={{ marginTop: 24 }}>
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{pref.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{pref.desc}</div>
            </div>
            <span
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                padding: "4px 12px",
                background: "var(--bg-surface-alt)",
                borderRadius: 6,
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
          padding: 16,
          marginBottom: 20,
          borderRadius: 8,
          border: "2px solid var(--color-primary)",
          background: "var(--bg-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 8, color: "var(--success)" }}>●</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{currentName || "moviemanager"}</span>
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: "var(--text-muted)",
            wordBreak: "break-all",
          }}
        >
          {currentPath || "Chemin par défaut"}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={onCreate}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-primary)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Nouvelle base
        </button>
        <button
          onClick={() => onOpen?.("")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Ouvrir un fichier .db
        </button>
        <button
          onClick={onBackup}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Sauvegarder (ZIP)
        </button>
        <button
          onClick={onExportJson}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Export JSON
        </button>
        <button
          onClick={onExportCsv}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Demo data */}
      <SectionTitle>Données de test</SectionTitle>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleSeedDemo}
            disabled={seedMutation.isPending}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 500,
              cursor: seedMutation.isPending ? "wait" : "pointer",
              opacity: seedMutation.isPending ? 0.6 : 1,
            }}
          >
            {seedMutation.isPending ? "Insertion en cours..." : "Charger données de démo"}
          </button>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Insère films, séries, personnes, tags, règles, etc. pour tester toutes les pages.
          </span>
        </div>
        {seedMessage && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: 12,
              background: seedMutation.isError ? "var(--score-d-bg)" : "var(--score-a-bg)",
              color: seedMutation.isError ? "var(--score-d-text)" : "var(--score-a-text)",
              border: `1px solid ${seedMutation.isError ? "var(--error)" : "var(--success)"}`,
            }}
          >
            {seedMessage}
          </div>
        )}
      </div>

      {/* Recent databases */}
      <SectionTitle>Bases récentes</SectionTitle>
      {recentDatabases.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune base récente</p>
      ) : (
        <div style={{ marginTop: 8 }}>
          {recentDatabases.map((db, i) => {
            const isActive = db.path === currentPath;
            return (
              <div
                key={i}
                onClick={() => !isActive && onOpen?.(db.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 14px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: isActive ? "1px solid var(--color-primary)" : "1px solid var(--border)",
                  background: isActive ? "var(--color-primary-soft)" : "var(--bg-surface)",
                  cursor: isActive ? "default" : "pointer",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {db.name}
                    {isActive && (
                      <span style={{ fontSize: 10, color: "var(--color-primary)", marginLeft: 8 }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      color: "var(--text-muted)",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {db.path}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
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
    padding: "5px 12px",
    borderRadius: 6,
    border: variant === "primary" ? "none" : "1px solid var(--border)",
    background: variant === "primary" ? "var(--color-primary)" : variant === "danger" ? "transparent" : "transparent",
    color: variant === "primary" ? "#fff" : variant === "danger" ? "var(--error)" : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: variant === "primary" ? 600 : 500,
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle>Genres disponibles</SectionTitle>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
        Liste des genres utilisés pour classifier films et séries. Modifiez ou supprimez en toute sécurité — les genres TMDB sont recréés automatiquement lors des imports.
      </p>

      {/* Add genre */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Nouveau genre…"
          style={{
            flex: 1,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
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
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Chargement…</p>
      ) : genres.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun genre enregistré.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {genres.map((g) => (
            <div
              key={g.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: editingId === g.id ? "var(--color-primary-soft)" : "var(--bg-surface)",
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
                      flex: 1,
                      padding: "4px 8px",
                      borderRadius: 5,
                      border: "1px solid var(--color-primary)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                  <button onClick={confirmEdit} style={btnStyle("primary")}>OK</button>
                  <button onClick={() => setEditingId(null)} style={btnStyle("ghost")}>Annuler</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{g.name}</span>
                  {g.tmdb_id && (
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
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

      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 16 }}>
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
    return <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Chargement…</div>;
  }

  return (
    <div style={{ maxWidth: 660 }}>
      <SectionTitle>Score qualité — poids des critères</SectionTitle>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        Ajustez le nombre maximum de points attribués à chaque critère. Le total des points
        s'adapte automatiquement. Les seuils de notation restent proportionnels
        (A ≥ 71 %, B ≥ 48 %, C ≥ 29 % du total maximum).
      </p>

      {/* Grade thresholds preview */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {GRADE_INFO.map((g) => {
          const minPts = Math.ceil(totalMax * g.pct / 100);
          return (
            <div
              key={g.grade}
              style={{
                flex: "1 1 100px",
                padding: "10px 12px",
                borderRadius: 8,
                background: g.bg,
                border: `1px solid ${g.color}33`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{
                  fontSize: 16, fontWeight: 700, color: g.color,
                  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 5, background: `${g.color}22`,
                }}>
                  {g.grade}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: g.color }}>{g.label}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {g.pct > 0 ? `≥ ${minPts} / ${totalMax} pts` : `< ${Math.ceil(totalMax * 0.29 / 100)} pts`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {CRITERIA.map(({ key, label, detail }) => {
          const val = weights[key];
          const pct = totalMax > 0 ? Math.round(val / totalMax * 100) : 0;
          return (
            <div
              key={key}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{detail}</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 80 }}>
                  <span style={{
                    fontSize: 18, fontWeight: 700, color: "var(--color-primary)",
                  }}>{val}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>pts</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{pct}% du total</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 10 }}>0</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={val}
                  onChange={(e) => handleChange(key, Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--color-primary)" }}
                />
                <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 24 }}>100</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderRadius: 8,
        background: "var(--bg-surface-alt)",
        border: "1px solid var(--border)",
        marginBottom: 20,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Total maximum</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>
          {totalMax} pts
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={handleReset}
          disabled={!isDirty}
          style={{
            padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            border: "1px solid var(--border)", background: "var(--bg-surface)",
            color: "var(--text-secondary)", cursor: isDirty ? "pointer" : "not-allowed",
            opacity: isDirty ? 1 : 0.5,
          }}
        >
          Réinitialiser
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || setWeights.isPending}
          style={{
            padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            border: "none", background: "var(--color-primary)", color: "#fff",
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
            padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            border: "1px solid var(--color-primary)", background: "transparent",
            color: "var(--color-primary)", cursor: !recompute.isPending && !isDirty ? "pointer" : "not-allowed",
            opacity: !recompute.isPending && !isDirty ? 1 : 0.5,
          }}
        >
          {recompute.isPending ? "Recalcul en cours…" : "Recalculer tous les films"}
        </button>
      </div>

      {recompute.isSuccess && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--success)" }}>
          {recompute.data} version{(recompute.data ?? 0) > 1 ? "s" : ""} mise{(recompute.data ?? 0) > 1 ? "s" : ""} à jour.
        </div>
      )}
      {setWeights.isSuccess && !isDirty && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--success)" }}>
          Poids enregistrés. Cliquez sur "Recalculer tous les films" pour appliquer.
        </div>
      )}
      {(setWeights.isError || recompute.isError) && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--error, #e74c3c)" }}>
          Erreur : {String((setWeights.error || recompute.error) ?? "inconnu")}
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 20, lineHeight: 1.5 }}>
        Le score est calculé lors de l'analyse FFprobe de chaque fichier, et peut être recalculé
        à tout moment sans relancer FFprobe en utilisant les données techniques déjà stockées.
      </p>
    </div>
  );
}

function AboutTab() {
  return (
    <div style={{ maxWidth: 400 }}>
      <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>MovieManager</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Version 0.1.0 — MVP</div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 16 }}>
        Application desktop de gestion de collection de fichiers vidéo. Cataloguez, organisez,
        enrichissez et maintenez votre collection de films et séries TV.
      </p>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tauri 2 + React + SQLite</div>
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
      <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <SectionTitle>FFprobe</SectionTitle>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Vérification en cours…</p>
      </div>
    );
  }

  const available = status?.available ?? false;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: available ? "1px solid var(--border)" : "2px solid var(--warning)",
        background: available ? "var(--bg-surface)" : "var(--score-c-bg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <SectionTitle>FFprobe / FFmpeg</SectionTitle>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 4,
            background: available ? "var(--score-a-bg)" : "var(--score-d-bg)",
            color: available ? "var(--score-a-text)" : "var(--score-d-text)",
          }}
        >
          {available ? "Détecté" : "Non trouvé"}
        </span>
      </div>

      {available ? (
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr",
              rowGap: 4,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Version</span>
            <span>{status?.version ?? "inconnue"}</span>
            <span style={{ color: "var(--text-muted)" }}>Chemin</span>
            <span style={{ fontFamily: "monospace", fontSize: 11 }}>{status?.path ?? "PATH système"}</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            L'analyse technique des fichiers vidéo (codec, résolution, bitrate, audio) est active.
          </p>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          <p style={{ marginBottom: 8 }}>
            FFprobe est nécessaire pour analyser les fichiers vidéo (codec, résolution, bitrate, canaux audio).
            Sans FFprobe, le scan fonctionne mais les métadonnées techniques ne seront pas extraites.
          </p>
          <p style={{ fontWeight: 500, marginBottom: 8 }}>
            Installation recommandée :
          </p>
          <div style={{ fontSize: 11, padding: "8px 12px", borderRadius: 6, background: "var(--bg-surface)", border: "1px solid var(--border)", marginBottom: 8 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>Windows : </span>
              <span style={{ color: "var(--text-muted)" }}>
                Téléchargez FFmpeg depuis ffmpeg.org/download.html et ajoutez le dossier bin au PATH système.
              </span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>macOS : </span>
              <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>brew install ffmpeg</span>
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Linux : </span>
              <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>sudo apt install ffmpeg</span>
            </div>
          </div>
          {status?.error && (
            <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
              {status.error}
            </p>
          )}
          <button
            onClick={() => refetch()}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Revérifier
          </button>
        </div>
      )}
    </div>
  );
}
