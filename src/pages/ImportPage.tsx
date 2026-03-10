import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ScannedFilePreview,
  ImportFileInput,
  ImportFileResult,
  TmdbMovieSearchResult,
  TmdbSeriesSearchResult,
} from "../lib/api";
import { previewScanPaths, importFiles, searchMovieTmdb, searchSeriesTmdb } from "../lib/api";

// ============================================================================
// Types
// ============================================================================

type Phase = "drop" | "preview" | "importing" | "done";

/** User-editable row built from ScannedFilePreview */
interface PreviewRow extends ScannedFilePreview {
  /** User-edited title */
  editTitle: string;
  /** User-edited year */
  editYear: string;
  /** "movie" | "series" */
  editType: string;
  /** TMDB id validated by the user */
  tmdbId: number | null;
  /** Whether this row is included in the import */
  included: boolean;
  /** TMDB suggestion loaded for this row */
  tmdbSuggestion: TmdbSuggestion | null;
  /** Whether the TMDB suggestion popup is open */
  tmdbPending: boolean;
}

interface TmdbSuggestion {
  tmdb_id: number;
  title: string;
  year: string | null;
  overview: string | null;
  poster_path: string | null;
}

// ============================================================================
// ImportPage
// ============================================================================

export function ImportPage({
  initialPaths = [],
  onPathsConsumed,
}: {
  initialPaths?: string[];
  onPathsConsumed?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("drop");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [results, setResults] = useState<ImportFileResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [tmdbSearching, setTmdbSearching] = useState<string | null>(null); // file_path being searched

  // ── Bulk-edit state ──
  const [bulkType, setBulkType] = useState<string>("");
  const [bulkYear, setBulkYear] = useState<string>("");

  // ── Scanning ──────────────────────────────────────────────────────────────

  const scanPaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setScanning(true);
    setScanError(null);
    try {
      const previews = await previewScanPaths(paths);
      if (previews.length === 0) {
        setScanError("Aucun fichier vidéo trouvé dans les chemins sélectionnés.");
        setScanning(false);
        return;
      }
      const mapped: PreviewRow[] = previews.map((p) => ({
        ...p,
        editTitle: p.parsed_title ?? p.file_name,
        editYear: p.parsed_year != null ? String(p.parsed_year) : "",
        editType: p.entity_type === "episode" ? "series" : "movie",
        tmdbId: null,
        included: !p.is_duplicate,
        tmdbSuggestion: null,
        tmdbPending: false,
      }));
      setRows(mapped);
      setPhase("preview");
    } catch (e) {
      setScanError(String(e));
    } finally {
      setScanning(false);
    }
  }, []);

  // Auto-scan when paths are injected from the header button
  useEffect(() => {
    if (initialPaths.length > 0) {
      scanPaths(initialPaths);
      onPathsConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drop zone ─────────────────────────────────────────────────────────────

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const paths: string[] = [];

      // Preferred on Tauri: native absolute paths from dropped files.
      for (const file of Array.from(e.dataTransfer.files)) {
        const nativePath = (file as File & { path?: string }).path;
        if (nativePath) paths.push(nativePath);
      }

      // Fallback for environments not exposing file.path.
      if (paths.length === 0) {
        for (const item of Array.from(e.dataTransfer.items)) {
          if (item.kind !== "file") continue;
          const entry = item.webkitGetAsEntry?.();
          const fullPath = (entry as { fullPath?: string } | null)?.fullPath;
          if (fullPath && (fullPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(fullPath))) {
            paths.push(fullPath);
          }
        }
      }

      const deduped = Array.from(new Set(paths));
      if (deduped.length > 0) {
        await scanPaths(deduped);
      }
    },
    [scanPaths]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // ── File picker via Tauri dialog ──────────────────────────────────────────

  const onBrowse = useCallback(async () => {
    try {
      const selected = await invoke<string[] | null>("plugin:dialog|open", {
        multiple: true,
        directory: false,
        filters: [
          {
            name: "Vidéos",
            extensions: [
              "mkv", "mp4", "avi", "mov", "wmv", "flv", "webm",
              "m4v", "ts", "m2ts", "mpg", "mpeg", "rm", "rmvb",
            ],
          },
        ],
      });
      if (selected && selected.length > 0) await scanPaths(selected);
    } catch {
      // fallback — try directory too
      try {
        const dir = await invoke<string | null>("plugin:dialog|open", {
          multiple: false,
          directory: true,
        });
        if (dir) await scanPaths([dir]);
      } catch (e2) {
        setScanError(String(e2));
      }
    }
  }, [scanPaths]);

  const onBrowseDir = useCallback(async () => {
    try {
      const selected = await invoke<string | string[] | null>("plugin:dialog|open", {
        multiple: true,
        directory: true,
      });
      if (!selected) return;
      const dirs = Array.isArray(selected) ? selected : [selected];
      await scanPaths(dirs);
    } catch (e) {
      setScanError(String(e));
    }
  }, [scanPaths]);

  // ── Row editing ───────────────────────────────────────────────────────────

  const updateRow = (filePath: string, patch: Partial<PreviewRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.file_path === filePath ? { ...r, ...patch } : r))
    );
  };

  const toggleAll = (included: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, included })));
  };

  const applyBulkEdit = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (!r.included) return r;
        const patch: Partial<PreviewRow> = {};
        if (bulkType) patch.editType = bulkType;
        if (bulkYear) patch.editYear = bulkYear;
        return { ...r, ...patch };
      })
    );
    setBulkType("");
    setBulkYear("");
  };

  // ── TMDB lookup per row ───────────────────────────────────────────────────

  const searchTmdb = useCallback(async (row: PreviewRow) => {
    const title = row.editTitle.trim();
    if (!title) return;
    setTmdbSearching(row.file_path);
    try {
      if (row.editType === "series") {
        const results: TmdbSeriesSearchResult[] = await searchSeriesTmdb(title, undefined);
        const first = results[0];
        if (first) {
          const year = first.first_air_date?.slice(0, 4) ?? null;
          updateRow(row.file_path, {
            tmdbSuggestion: {
              tmdb_id: first.id,
              title: first.name,
              year,
              overview: first.overview ?? null,
              poster_path: first.poster_path ?? null,
            },
            tmdbPending: true,
          });
        } else {
          updateRow(row.file_path, { tmdbSuggestion: null, tmdbPending: false });
          alert(`Aucun résultat TMDB pour "${title}"`);
        }
      } else {
        const results: TmdbMovieSearchResult[] = await searchMovieTmdb(title, row.editYear ? Number(row.editYear) : undefined);
        const first = results[0];
        if (first) {
          const year = first.release_date?.slice(0, 4) ?? null;
          updateRow(row.file_path, {
            tmdbSuggestion: {
              tmdb_id: first.id,
              title: first.title,
              year,
              overview: first.overview ?? null,
              poster_path: first.poster_path ?? null,
            },
            tmdbPending: true,
          });
        } else {
          updateRow(row.file_path, { tmdbSuggestion: null, tmdbPending: false });
          alert(`Aucun résultat TMDB pour "${title}"`);
        }
      }
    } catch (e) {
      alert(`Erreur TMDB : ${e}`);
    } finally {
      setTmdbSearching(null);
    }
  }, []);

  const acceptTmdb = (row: PreviewRow) => {
    if (!row.tmdbSuggestion) return;
    updateRow(row.file_path, {
      tmdbId: row.tmdbSuggestion.tmdb_id,
      editTitle: row.tmdbSuggestion.title,
      editYear: row.tmdbSuggestion.year ?? row.editYear,
      tmdbPending: false,
    });
  };

  const rejectTmdb = (row: PreviewRow) => {
    updateRow(row.file_path, { tmdbSuggestion: null, tmdbPending: false });
  };

  // ── Batch TMDB scan ───────────────────────────────────────────────────────

  const searchAllTmdb = useCallback(async () => {
    const included = rows.filter((r) => r.included && !r.tmdbId);
    for (const row of included) {
      await searchTmdb(row);
    }
  }, [rows, searchTmdb]);

  // ── Import ────────────────────────────────────────────────────────────────

  const startImport = useCallback(async () => {
    const included = rows.filter((r) => r.included);
    if (included.length === 0) return;

    setPhase("importing");

    const inputs: ImportFileInput[] = included.map((r) => ({
      file_path: r.file_path,
      title: r.editTitle || r.file_name,
      year: r.editYear ? Number(r.editYear) : null,
      entity_type: r.editType,
      tmdb_id: r.tmdbId,
    }));

    try {
      const res = await importFiles(inputs);
      setResults(res);
      setPhase("done");
    } catch (e) {
      alert(`Erreur d'import : ${e}`);
      setPhase("preview");
    }
  }, [rows]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-main)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "18px 24px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-main)" }}>
          Importer des vidéos
        </h2>

        {phase === "preview" && (
          <>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {rows.filter((r) => r.included).length} / {rows.length} fichiers sélectionnés
            </span>
            <button
              onClick={() => { setPhase("drop"); setRows([]); setScanError(null); }}
              style={btnStyle("ghost")}
            >
              ← Recommencer
            </button>
            <button
              onClick={searchAllTmdb}
              style={btnStyle("secondary")}
              disabled={tmdbSearching != null}
            >
              {tmdbSearching ? "Recherche TMDB…" : "TMDB auto"}
            </button>
            <button
              onClick={startImport}
              style={btnStyle("primary")}
              disabled={rows.filter((r) => r.included).length === 0}
            >
              Importer →
            </button>
          </>
        )}

        {phase === "done" && (
          <>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => { setPhase("drop"); setRows([]); setResults([]); setScanError(null); }}
              style={btnStyle("secondary")}
            >
              Nouvel import
            </button>
          </>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {phase === "drop" && (
          <DropPhase
            scanning={scanning}
            error={scanError}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onBrowseFiles={onBrowse}
            onBrowseDir={onBrowseDir}
          />
        )}

        {phase === "preview" && (
          <PreviewPhase
            rows={rows}
            bulkType={bulkType}
            bulkYear={bulkYear}
            tmdbSearching={tmdbSearching}
            onBulkTypeChange={setBulkType}
            onBulkYearChange={setBulkYear}
            onApplyBulk={applyBulkEdit}
            onToggleAll={toggleAll}
            onUpdateRow={updateRow}
            onSearchTmdb={searchTmdb}
            onAcceptTmdb={acceptTmdb}
            onRejectTmdb={rejectTmdb}
          />
        )}

        {phase === "importing" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 16,
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: 32 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-main)" }}>
              Import en cours…
            </div>
          </div>
        )}

        {phase === "done" && <DonePhase results={results} />}
      </div>
    </div>
  );
}

// ============================================================================
// DropPhase
// ============================================================================

function DropPhase({
  scanning,
  error,
  onDrop,
  onDragOver,
  onBrowseFiles,
  onBrowseDir,
}: {
  scanning: boolean;
  error: string | null;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onBrowseFiles: () => void;
  onBrowseDir: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 24,
        padding: 32,
      }}
    >
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        style={{
          width: "100%",
          maxWidth: 560,
          border: "2px dashed var(--border)",
          borderRadius: 16,
          padding: "48px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          background: "var(--bg-surface)",
          cursor: "pointer",
          transition: "border-color 0.2s, background 0.2s",
        }}
        onDragEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--color-primary)";
          e.currentTarget.style.background = "var(--color-primary-soft)";
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.background = "var(--bg-surface)";
        }}
      >
        <div style={{ fontSize: 40 }}>🎬</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-main)" }}>
          {scanning ? "Analyse en cours…" : "Déposez vos fichiers vidéo ici"}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          MKV, MP4, AVI, MOV et autres formats vidéo
        </div>

        {!scanning && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={onBrowseFiles} style={btnStyle("primary")}>
              Choisir des fichiers
            </button>
            <button onClick={onBrowseDir} style={btnStyle("secondary")}>
              Choisir un dossier
            </button>
          </div>
        )}

        {scanning && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Scan du répertoire…
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "10px 16px",
            background: "var(--error-soft, #fee2e2)",
            border: "1px solid var(--error)",
            borderRadius: 8,
            color: "var(--error)",
            fontSize: 13,
            maxWidth: 560,
            width: "100%",
          }}
        >
          {error}
        </div>
      )}

      {/* Hidden file input (unused — Tauri dialog handles picking) */}
      <input type="file" multiple style={{ display: "none" }} />
    </div>
  );
}

// ============================================================================
// PreviewPhase
// ============================================================================

function PreviewPhase({
  rows,
  bulkType,
  bulkYear,
  tmdbSearching,
  onBulkTypeChange,
  onBulkYearChange,
  onApplyBulk,
  onToggleAll,
  onUpdateRow,
  onSearchTmdb,
  onAcceptTmdb,
  onRejectTmdb,
}: {
  rows: PreviewRow[];
  bulkType: string;
  bulkYear: string;
  tmdbSearching: string | null;
  onBulkTypeChange: (v: string) => void;
  onBulkYearChange: (v: string) => void;
  onApplyBulk: () => void;
  onToggleAll: (v: boolean) => void;
  onUpdateRow: (filePath: string, patch: Partial<PreviewRow>) => void;
  onSearchTmdb: (row: PreviewRow) => void;
  onAcceptTmdb: (row: PreviewRow) => void;
  onRejectTmdb: (row: PreviewRow) => void;
}) {
  const allChecked = rows.every((r) => r.included);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Bulk edit bar */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          Édition en lot :
        </span>
        <select
          value={bulkType}
          onChange={(e) => onBulkTypeChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">— Type —</option>
          <option value="movie">Film</option>
          <option value="series">Série</option>
        </select>
        <input
          value={bulkYear}
          onChange={(e) => onBulkYearChange(e.target.value)}
          placeholder="Année"
          style={{ ...inputStyle, width: 80 }}
        />
        <button
          onClick={onApplyBulk}
          style={btnStyle("secondary")}
          disabled={!bulkType && !bulkYear}
        >
          Appliquer aux sélectionnés
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={() => onToggleAll(true)} style={btnStyle("ghost")}>
          Tout sélectionner
        </button>
        <button onClick={() => onToggleAll(false)} style={btnStyle("ghost")}>
          Tout désélectionner
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                position: "sticky",
                top: 0,
                background: "var(--bg-surface)",
                zIndex: 2,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <Th style={{ width: 36, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </Th>
              <Th>Titre</Th>
              <Th style={{ width: 80 }}>Année</Th>
              <Th style={{ width: 90 }}>Type</Th>
              <Th style={{ width: 80 }}>Qualité</Th>
              <Th style={{ width: 70, textAlign: "right" }}>Taille</Th>
              <Th style={{ width: 60, textAlign: "center" }}>Conf.</Th>
              <Th style={{ width: 60, textAlign: "center" }}>TMDB</Th>
              <Th style={{ width: 60, textAlign: "center" }}>Doublon</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PreviewRow
                key={row.file_path}
                row={row}
                searching={tmdbSearching === row.file_path}
                onUpdate={(patch) => onUpdateRow(row.file_path, patch)}
                onSearchTmdb={() => onSearchTmdb(row)}
                onAcceptTmdb={() => onAcceptTmdb(row)}
                onRejectTmdb={() => onRejectTmdb(row)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewRow({
  row,
  searching,
  onUpdate,
  onSearchTmdb,
  onAcceptTmdb,
  onRejectTmdb,
}: {
  row: PreviewRow;
  searching: boolean;
  onUpdate: (patch: Partial<PreviewRow>) => void;
  onSearchTmdb: () => void;
  onAcceptTmdb: () => void;
  onRejectTmdb: () => void;
}) {
  const bg = !row.included
    ? "var(--bg-surface-alt)"
    : row.is_duplicate
    ? "#fef9c3"
    : row.tmdbId
    ? "#f0fdf4"
    : undefined;

  return (
    <>
      <tr
        style={{
          borderBottom: "1px solid var(--border)",
          background: bg,
          opacity: row.included ? 1 : 0.5,
        }}
      >
        {/* Checkbox */}
        <td style={{ textAlign: "center", padding: "6px 4px" }}>
          <input
            type="checkbox"
            checked={row.included}
            onChange={(e) => onUpdate({ included: e.target.checked })}
          />
        </td>

        {/* Title */}
        <td style={{ padding: "4px 8px" }}>
          <input
            value={row.editTitle}
            onChange={(e) => onUpdate({ editTitle: e.target.value })}
            style={{ ...inputStyle, width: "100%" }}
            title={row.file_name}
          />
          {row.tmdbId && (
            <span style={{ fontSize: 10, color: "var(--success)", marginLeft: 4 }}>
              ✓ TMDB #{row.tmdbId}
            </span>
          )}
        </td>

        {/* Year */}
        <td style={{ padding: "4px 6px" }}>
          <input
            value={row.editYear}
            onChange={(e) => onUpdate({ editYear: e.target.value })}
            style={{ ...inputStyle, width: 70 }}
            maxLength={4}
          />
        </td>

        {/* Type */}
        <td style={{ padding: "4px 6px" }}>
          <select
            value={row.editType}
            onChange={(e) => onUpdate({ editType: e.target.value })}
            style={selectStyle}
          >
            <option value="movie">Film</option>
            <option value="series">Série</option>
          </select>
        </td>

        {/* Quality */}
        <td style={{ padding: "4px 6px", color: "var(--text-muted)" }}>
          {row.quality ?? "—"}
        </td>

        {/* Size */}
        <td style={{ padding: "4px 8px", textAlign: "right", color: "var(--text-muted)" }}>
          {row.file_size_mb < 1000
            ? `${row.file_size_mb.toFixed(0)} Mo`
            : `${(row.file_size_mb / 1024).toFixed(1)} Go`}
        </td>

        {/* Confidence */}
        <td style={{ textAlign: "center", padding: "4px 6px" }}>
          <ConfidenceBadge value={row.confidence} />
        </td>

        {/* TMDB action */}
        <td style={{ textAlign: "center", padding: "4px 6px" }}>
          {row.tmdbId ? (
            <button
              onClick={() => onUpdate({ tmdbId: null, tmdbSuggestion: null })}
              title="Retirer l'association TMDB"
              style={{ ...btnStyle("ghost"), fontSize: 11, padding: "2px 6px" }}
            >
              ×
            </button>
          ) : (
            <button
              onClick={onSearchTmdb}
              disabled={searching}
              title="Rechercher sur TMDB"
              style={{ ...btnStyle("secondary"), fontSize: 11, padding: "2px 6px" }}
            >
              {searching ? "…" : "🔍"}
            </button>
          )}
        </td>

        {/* Duplicate indicator */}
        <td style={{ textAlign: "center", padding: "4px 6px" }}>
          {row.is_duplicate ? (
            <span title={`Déjà importé : ${row.duplicate_title ?? ""}`} style={{ color: "var(--warning, #f59e0b)", fontSize: 14 }}>
              ⚠
            </span>
          ) : (
            <span style={{ color: "var(--success)", fontSize: 14 }}>✓</span>
          )}
        </td>
      </tr>

      {/* TMDB suggestion popup row */}
      {row.tmdbPending && row.tmdbSuggestion && (
        <tr style={{ background: "var(--color-primary-soft)" }}>
          <td />
          <td colSpan={8} style={{ padding: "8px 12px" }}>
            <TmdbSuggestionBanner
              suggestion={row.tmdbSuggestion}
              onAccept={onAcceptTmdb}
              onReject={onRejectTmdb}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function TmdbSuggestionBanner({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: TmdbSuggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--bg-surface)",
        border: "1px solid var(--color-primary)",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
        {suggestion.title}
        {suggestion.year && (
          <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>
            ({suggestion.year})
          </span>
        )}
      </div>
      {suggestion.overview && (
        <div
          style={{
            flex: 1,
            fontSize: 12,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {suggestion.overview}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={onAccept} style={btnStyle("primary")}>
          ✓ Valider
        </button>
        <button onClick={onReject} style={btnStyle("ghost")}>
          × Refuser
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// DonePhase
// ============================================================================

function DonePhase({ results }: { results: ImportFileResult[] }) {
  const imported = results.filter((r) => r.status === "imported");
  const inbox = results.filter((r) => r.status === "inbox");
  const errors = results.filter((r) => r.status === "error");

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
        Import terminé
      </h3>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <SummaryPill count={imported.length} label="importés" color="var(--success)" />
        <SummaryPill count={inbox.length} label="en attente (Inbox)" color="var(--warning, #f59e0b)" />
        <SummaryPill count={errors.length} label="erreurs" color="var(--error)" />
      </div>

      {/* Imported */}
      {imported.length > 0 && (
        <ResultGroup
          title="Importés avec succès"
          rows={imported}
          badge="✓"
          badgeColor="var(--success)"
        />
      )}

      {/* Inbox */}
      {inbox.length > 0 && (
        <ResultGroup
          title="Envoyés vers l'Inbox (sans association TMDB)"
          rows={inbox}
          badge="⏳"
          badgeColor="var(--warning, #f59e0b)"
        />
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <ResultGroup
          title="Erreurs"
          rows={errors}
          badge="✗"
          badgeColor="var(--error)"
          showError
        />
      )}
    </div>
  );
}

function SummaryPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 20,
        background: "var(--bg-surface)",
        border: `1px solid ${color}`,
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

function ResultGroup({
  title,
  rows,
  badge,
  badgeColor,
  showError = false,
}: {
  title: string;
  rows: ImportFileResult[];
  badge: string;
  badgeColor: string;
  showError?: boolean;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.file_path}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "8px 14px",
              borderTop: i > 0 ? "1px solid var(--border)" : undefined,
            }}
          >
            <span style={{ color: badgeColor, flexShrink: 0 }}>{badge}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, color: "var(--text-main)" }}>{r.title}</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.file_path}
              </div>
              {showError && r.error && (
                <div style={{ fontSize: 12, color: "var(--error)", marginTop: 2 }}>
                  {r.error}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Small helpers
// ============================================================================

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 80 ? "var(--success)" : value >= 50 ? "var(--warning, #f59e0b)" : "var(--error)";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color }}>{value}%</span>
  );
}

function Th({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: "8px 8px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--text-muted)",
        textAlign: "left",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

// ── Shared micro-styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--bg-main)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "3px 7px",
  fontSize: 13,
  color: "var(--text-main)",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  background: "var(--bg-main)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "3px 6px",
  fontSize: 13,
  color: "var(--text-main)",
  cursor: "pointer",
};

function btnStyle(variant: "primary" | "secondary" | "ghost"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "opacity 0.1s",
  };
  if (variant === "primary")
    return { ...base, background: "var(--color-primary)", color: "#fff" };
  if (variant === "secondary")
    return {
      ...base,
      background: "var(--bg-surface-alt)",
      color: "var(--text-main)",
      border: "1px solid var(--border)",
    };
  return { ...base, background: "transparent", color: "var(--text-secondary)" };
}
