import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ScannedFilePreview,
  ImportFileInput,
  ImportFileResult,
  DryRunSummary,
  TmdbMovieSearchResult,
  TmdbSeriesSearchResult,
} from "../lib/api";
import { previewScanPaths, importFiles, dryRunImport, searchMovieTmdb, searchSeriesTmdb } from "../lib/api";
import { COLORS, SP, FONT, WEIGHT, RADIUS, TRANSITION, flex, cell, th as thPreset, badge, input as inputPreset } from "../lib/tokens";

// ============================================================================
// Types
// ============================================================================

type Phase = "drop" | "preview" | "confirm" | "importing" | "done";

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
  const [dryRunData, setDryRunData] = useState<DryRunSummary | null>(null);
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

  // ── Dry-run (impact preview) ──────────────────────────────────────────────

  const buildInputs = useCallback((): ImportFileInput[] => {
    return rows.filter((r) => r.included).map((r) => ({
      file_path: r.file_path,
      title: r.editTitle || r.file_name,
      year: r.editYear ? Number(r.editYear) : null,
      entity_type: r.editType,
      tmdb_id: r.tmdbId,
    }));
  }, [rows]);

  const startDryRun = useCallback(async () => {
    const inputs = buildInputs();
    if (inputs.length === 0) return;

    setScanning(true);
    try {
      const summary = await dryRunImport(inputs);
      setDryRunData(summary);
      setPhase("confirm");
    } catch (e) {
      alert(`Erreur dry-run : ${e}`);
    } finally {
      setScanning(false);
    }
  }, [buildInputs]);

  // ── Import (after confirmation) ─────────────────────────────────────────

  const confirmImport = useCallback(async () => {
    const inputs = buildInputs();
    if (inputs.length === 0) return;

    setPhase("importing");

    try {
      const res = await importFiles(inputs);
      setResults(res);
      setPhase("done");
    } catch (e) {
      alert(`Erreur d'import : ${e}`);
      setPhase("confirm");
    }
  }, [buildInputs]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        ...flex.col,
        flex: 1,
        overflow: "hidden",
        background: "var(--bg-main)",
      }}
    >
      {/* Header */}
      <div
        style={{
          ...flex.rowGap(SP.xl),
          padding: `${SP.huge}px ${SP.mega}px ${SP.xxl}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bgSurface,
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: WEIGHT.bold, color: COLORS.textMain }}>
          Importer des vidéos
        </h2>

        {phase === "preview" && (
          <>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: FONT.md, color: COLORS.textMuted }}>
              {rows.filter((r) => r.included).length} / {rows.length} fichiers selectionnes
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
              {tmdbSearching ? "Recherche TMDB..." : "TMDB auto"}
            </button>
            <button
              onClick={startDryRun}
              style={btnStyle("primary")}
              disabled={rows.filter((r) => r.included).length === 0 || scanning}
            >
              {scanning ? "Analyse..." : "Verifier l'impact →"}
            </button>
          </>
        )}

        {phase === "confirm" && (
          <>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setPhase("preview")}
              style={btnStyle("ghost")}
            >
              ← Modifier
            </button>
            <button
              onClick={confirmImport}
              style={btnStyle("primary")}
            >
              Confirmer l'import →
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

        {phase === "confirm" && dryRunData && (
          <ConfirmPhase summary={dryRunData} />
        )}

        {phase === "importing" && (
          <div
            style={{
              ...flex.col,
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: SP.xxxl,
              color: COLORS.textMuted,
            }}
          >
            <div style={{ fontSize: SP.giga }}>⏳</div>
            <div style={{ fontSize: FONT.xl, fontWeight: WEIGHT.semi, color: COLORS.textMain }}>
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
        ...flex.col,
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: SP.mega,
        padding: SP.giga,
      }}
    >
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        style={{
          ...flex.col,
          width: "100%",
          maxWidth: 560,
          border: `2px dashed ${COLORS.border}`,
          borderRadius: RADIUS.xl + 4,
          padding: `48px ${SP.giga}px`,
          alignItems: "center",
          gap: SP.xl,
          background: COLORS.bgSurface,
          cursor: "pointer",
          transition: `border-color ${TRANSITION.normal}, background ${TRANSITION.normal}`,
        }}
        onDragEnter={(e) => {
          e.currentTarget.style.borderColor = COLORS.primary;
          e.currentTarget.style.background = COLORS.primarySoft;
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = COLORS.border;
          e.currentTarget.style.background = COLORS.bgSurface;
        }}
      >
        <div style={{ fontSize: 40 }}>🎬</div>
        <div style={{ fontSize: FONT.xl, fontWeight: WEIGHT.semi, color: COLORS.textMain }}>
          {scanning ? "Analyse en cours…" : "Déposez vos fichiers vidéo ici"}
        </div>
        <div style={{ fontSize: FONT.md, color: COLORS.textMuted, textAlign: "center" }}>
          MKV, MP4, AVI, MOV et autres formats vidéo
        </div>

        {!scanning && (
          <div style={{ ...flex.rowGap(SP.base), marginTop: SP.base }}>
            <button onClick={onBrowseFiles} style={btnStyle("primary")}>
              Choisir des fichiers
            </button>
            <button onClick={onBrowseDir} style={btnStyle("secondary")}>
              Choisir un dossier
            </button>
          </div>
        )}

        {scanning && (
          <div style={{ fontSize: FONT.md, color: COLORS.textMuted }}>
            Scan du répertoire…
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: `${SP.lg}px ${SP.xxxl}px`,
            background: "var(--error-soft, #fee2e2)",
            border: `1px solid ${COLORS.error}`,
            borderRadius: RADIUS.lg,
            color: COLORS.error,
            fontSize: FONT.md,
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
    <div style={{ ...flex.col, height: "100%" }}>
      {/* Bulk edit bar */}
      <div
        style={{
          ...flex.rowGap(SP.lg),
          padding: `${SP.lg}px ${SP.xxxl}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bgSurface,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: FONT.base, fontWeight: WEIGHT.semi, color: COLORS.textMuted, textTransform: "uppercase" }}>
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
            fontSize: FONT.md,
          }}
        >
          <thead>
            <tr
              style={{
                position: "sticky",
                top: 0,
                background: COLORS.bgSurface,
                zIndex: 2,
                borderBottom: `1px solid ${COLORS.border}`,
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
    ? COLORS.bgSurfaceAlt
    : row.is_duplicate
    ? "#fef9c3"
    : row.tmdbId
    ? "#f0fdf4"
    : undefined;

  return (
    <>
      <tr
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          background: bg,
          opacity: row.included ? 1 : 0.5,
        }}
      >
        {/* Checkbox */}
        <td style={{ textAlign: "center", padding: `${SP.m}px ${SP.s}px` }}>
          <input
            type="checkbox"
            checked={row.included}
            onChange={(e) => onUpdate({ included: e.target.checked })}
          />
        </td>

        {/* Title */}
        <td style={{ padding: `${SP.s}px ${SP.base}px` }}>
          <input
            value={row.editTitle}
            onChange={(e) => onUpdate({ editTitle: e.target.value })}
            style={{ ...inputStyle, width: "100%" }}
            title={row.file_name}
          />
          {row.tmdbId && (
            <span style={{ fontSize: FONT.xs, color: COLORS.success, marginLeft: SP.s }}>
              ✓ TMDB #{row.tmdbId}
            </span>
          )}
        </td>

        {/* Year */}
        <td style={cell.compact}>
          <input
            value={row.editYear}
            onChange={(e) => onUpdate({ editYear: e.target.value })}
            style={{ ...inputStyle, width: 70 }}
            maxLength={4}
          />
        </td>

        {/* Type */}
        <td style={cell.compact}>
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
        <td style={{ ...cell.compact, color: COLORS.textMuted }}>
          {row.quality ?? "—"}
        </td>

        {/* Size */}
        <td style={{ padding: `${SP.s}px ${SP.base}px`, textAlign: "right", color: COLORS.textMuted }}>
          {row.file_size_mb < 1000
            ? `${row.file_size_mb.toFixed(0)} Mo`
            : `${(row.file_size_mb / 1024).toFixed(1)} Go`}
        </td>

        {/* Confidence */}
        <td style={{ textAlign: "center", ...cell.compact }}>
          <ConfidenceBadge value={row.confidence} />
        </td>

        {/* TMDB action */}
        <td style={{ textAlign: "center", ...cell.compact }}>
          {row.tmdbId ? (
            <button
              onClick={() => onUpdate({ tmdbId: null, tmdbSuggestion: null })}
              title="Retirer l'association TMDB"
              style={{ ...btnStyle("ghost"), fontSize: FONT.sm, padding: `${SP.xs}px ${SP.m}px` }}
            >
              ×
            </button>
          ) : (
            <button
              onClick={onSearchTmdb}
              disabled={searching}
              title="Rechercher sur TMDB"
              style={{ ...btnStyle("secondary"), fontSize: FONT.sm, padding: `${SP.xs}px ${SP.m}px` }}
            >
              {searching ? "…" : "🔍"}
            </button>
          )}
        </td>

        {/* Duplicate indicator */}
        <td style={{ textAlign: "center", ...cell.compact }}>
          {row.is_duplicate ? (
            <span title={`Déjà importé : ${row.duplicate_title ?? ""}`} style={{ color: COLORS.warning, fontSize: FONT.lg }}>
              ⚠
            </span>
          ) : (
            <span style={{ color: COLORS.success, fontSize: FONT.lg }}>✓</span>
          )}
        </td>
      </tr>

      {/* TMDB suggestion popup row */}
      {row.tmdbPending && row.tmdbSuggestion && (
        <tr style={{ background: COLORS.primarySoft }}>
          <td />
          <td colSpan={8} style={{ padding: `${SP.base}px ${SP.xl}px` }}>
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
        ...flex.rowGap(SP.xl),
        background: COLORS.bgSurface,
        border: `1px solid ${COLORS.primary}`,
        borderRadius: RADIUS.lg,
        padding: `${SP.base}px ${SP.xl}px`,
      }}
    >
      <div style={{ fontWeight: WEIGHT.semi, color: COLORS.textMain }}>
        {suggestion.title}
        {suggestion.year && (
          <span style={{ fontWeight: WEIGHT.normal, color: COLORS.textMuted, marginLeft: SP.m }}>
            ({suggestion.year})
          </span>
        )}
      </div>
      {suggestion.overview && (
        <div
          style={{
            flex: 1,
            fontSize: FONT.base,
            color: COLORS.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {suggestion.overview}
        </div>
      )}
      <div style={{ ...flex.rowGap(SP.m), flexShrink: 0 }}>
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
    <div style={{ padding: SP.giga, maxWidth: 720, margin: "0 auto" }}>
      <h3 style={{ margin: `0 0 ${SP.huge}px`, fontSize: FONT.xl, fontWeight: WEIGHT.bold, color: COLORS.textMain }}>
        Import terminé
      </h3>

      {/* Summary pills */}
      <div style={{ ...flex.rowGap(SP.xl), marginBottom: SP.mega }}>
        <SummaryPill count={imported.length} label="importés" color={COLORS.success} />
        <SummaryPill count={inbox.length} label="en attente (Inbox)" color={COLORS.warning} />
        <SummaryPill count={errors.length} label="erreurs" color={COLORS.error} />
      </div>

      {/* Imported */}
      {imported.length > 0 && (
        <ResultGroup
          title="Importés avec succès"
          rows={imported}
          badge="✓"
          badgeColor={COLORS.success}
        />
      )}

      {/* Inbox */}
      {inbox.length > 0 && (
        <ResultGroup
          title="Envoyés vers l'Inbox (sans association TMDB)"
          rows={inbox}
          badge="⏳"
          badgeColor={COLORS.warning}
        />
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <ResultGroup
          title="Erreurs"
          rows={errors}
          badge="✗"
          badgeColor={COLORS.error}
          showError
        />
      )}
    </div>
  );
}

// ============================================================================
// ConfirmPhase (dry-run impact summary)
// ============================================================================

function ConfirmPhase({ summary }: { summary: DryRunSummary }) {
  const actionConfig: Record<string, { label: string; color: string; badge: string }> = {
    create: { label: "A creer", color: COLORS.success, badge: "+" },
    update: { label: "A mettre a jour", color: COLORS.primary, badge: "↻" },
    inbox: { label: "Vers l'Inbox", color: COLORS.warning, badge: "⏳" },
    skip: { label: "Ignores (doublons)", color: COLORS.textMuted, badge: "—" },
  };

  return (
    <div style={{ padding: SP.giga, maxWidth: 720, margin: "0 auto" }}>
      <h3 style={{ margin: `0 0 ${SP.base}px`, fontSize: FONT.xl, fontWeight: WEIGHT.bold, color: COLORS.textMain }}>
        Previsualisation de l'import
      </h3>
      <p style={{ margin: `0 0 ${SP.huge}px`, fontSize: FONT.md, color: COLORS.textMuted }}>
        Voici l'impact prevu de l'import sur votre base. Verifiez avant de confirmer.
      </p>

      {/* Summary pills */}
      <div style={{ ...flex.rowGap(SP.xl), marginBottom: SP.mega, flexWrap: "wrap" }}>
        <SummaryPill count={summary.create} label="a creer" color={COLORS.success} />
        <SummaryPill count={summary.update} label="a mettre a jour" color={COLORS.primary} />
        <SummaryPill count={summary.inbox} label="vers l'Inbox" color={COLORS.warning} />
        <SummaryPill count={summary.skip} label="ignores" color={COLORS.textMuted} />
      </div>

      {/* Per-action groups */}
      {(["create", "update", "inbox", "skip"] as const).map((action) => {
        const items = summary.items.filter((i) => i.action === action);
        if (items.length === 0) return null;
        const cfg = actionConfig[action];
        return (
          <div key={action} style={{ marginBottom: SP.huge }}>
            <div
              style={{
                fontSize: FONT.base,
                fontWeight: WEIGHT.semi,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: cfg.color,
                marginBottom: SP.m,
              }}
            >
              {cfg.label} ({items.length})
            </div>
            <div
              style={{
                background: COLORS.bgSurface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.lg,
                overflow: "hidden",
              }}
            >
              {items.map((item, i) => (
                <div
                  key={item.file_path}
                  style={{
                    ...flex.row,
                    alignItems: "flex-start",
                    gap: SP.lg,
                    padding: `${SP.base}px ${SP.xxl}px`,
                    borderTop: i > 0 ? `1px solid ${COLORS.border}` : undefined,
                  }}
                >
                  <span style={{ color: cfg.color, flexShrink: 0, fontWeight: WEIGHT.bold, fontSize: FONT.lg }}>
                    {cfg.badge}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...flex.rowGap(SP.m) }}>
                      <span style={{ fontWeight: WEIGHT.medium, color: COLORS.textMain }}>{item.title}</span>
                      {item.entity_type && (
                        <span style={{
                          ...badge.base,
                          fontSize: FONT.tiny,
                          padding: `1px ${SP.s + 1}px`,
                          background: item.entity_type === "movie" ? COLORS.primary : "#8B5CF6",
                          color: "#fff",
                        }}>
                          {item.entity_type === "movie" ? "Film" : "Serie"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.xs }}>
                      {item.detail}
                    </div>
                    <div
                      style={{
                        fontSize: FONT.xs,
                        color: COLORS.textMuted,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 1,
                      }}
                    >
                      {item.file_path.split(/[/\\]/).pop()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
        ...flex.rowGap(SP.base),
        padding: `${SP.base}px ${SP.xxl}px`,
        borderRadius: RADIUS.full,
        background: COLORS.bgSurface,
        border: `1px solid ${color}`,
      }}
    >
      <span style={{ fontSize: FONT.xxl, fontWeight: WEIGHT.bold, color }}>{count}</span>
      <span style={{ fontSize: FONT.md, color: COLORS.textMuted }}>{label}</span>
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
    <div style={{ marginBottom: SP.huge }}>
      <div
        style={{
          fontSize: FONT.base,
          fontWeight: WEIGHT.semi,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: COLORS.textMuted,
          marginBottom: SP.m,
        }}
      >
        {title}
      </div>
      <div
        style={{
          background: COLORS.bgSurface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.lg,
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.file_path}
            style={{
              ...flex.row,
              alignItems: "flex-start",
              gap: SP.lg,
              padding: `${SP.base}px ${SP.xxl}px`,
              borderTop: i > 0 ? `1px solid ${COLORS.border}` : undefined,
            }}
          >
            <span style={{ color: badgeColor, flexShrink: 0 }}>{badge}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: WEIGHT.medium, color: COLORS.textMain }}>{r.title}</div>
              <div
                style={{
                  fontSize: FONT.sm,
                  color: COLORS.textMuted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.file_path}
              </div>
              {showError && r.error && (
                <div style={{ fontSize: FONT.base, color: COLORS.error, marginTop: SP.xs }}>
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
    value >= 80 ? COLORS.success : value >= 50 ? COLORS.warning : COLORS.error;
  return (
    <span style={{ fontSize: FONT.sm, fontWeight: WEIGHT.semi, color }}>{value}%</span>
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
        ...thPreset.base,
        fontSize: FONT.sm,
        fontWeight: WEIGHT.semi,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: COLORS.textMuted,
        borderBottom: "none",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

// ── Shared micro-styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  ...inputPreset.base,
  background: "var(--bg-main)",
  padding: `${SP.s - 1}px ${SP.base - 1}px`,
  fontSize: FONT.md,
};

const selectStyle: React.CSSProperties = {
  ...inputPreset.select,
  background: "var(--bg-main)",
  fontSize: FONT.md,
  cursor: "pointer",
};

function btnStyle(variant: "primary" | "secondary" | "ghost"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "none",
    borderRadius: RADIUS.md,
    padding: `${SP.m}px ${SP.xl}px`,
    fontSize: FONT.md,
    fontWeight: WEIGHT.medium,
    cursor: "pointer",
    transition: `opacity ${TRANSITION.fast}`,
  };
  if (variant === "primary")
    return { ...base, background: COLORS.primary, color: "#fff" };
  if (variant === "secondary")
    return {
      ...base,
      background: COLORS.bgSurfaceAlt,
      color: COLORS.textMain,
      border: `1px solid ${COLORS.border}`,
    };
  return { ...base, background: "transparent", color: COLORS.textSecondary };
}
