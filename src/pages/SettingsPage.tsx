import { useState } from "react";
import { TabBar, UnderlineInput, SectionTitle } from "../components/ui";
import type { Library } from "../lib/api";
import { useFfprobeStatus, useSeedDemoData } from "../lib/hooks";

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
          { id: "api", label: "API Keys" },
          { id: "general", label: "Général" },
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
        {tab === "api" && (
          <ApiKeysTab tmdbKey={tmdbKey} onChange={setTmdbKey} onSave={onSetTmdbKey} />
        )}
        {tab === "general" && <GeneralTab />}
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
