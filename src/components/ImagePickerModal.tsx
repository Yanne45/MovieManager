import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { TmdbImageCandidate, ImagePaths } from "../lib/api";
import {
  getTmdbImageCandidates,
  importLocalImage,
  applyTmdbImage,
  deleteEntityImage,
  getImagePaths,
} from "../lib/api";

// ============================================================================
// Types
// ============================================================================

export type ImageEntityType = "movie" | "series" | "person" | "studio";
export type ImageType = "poster" | "backdrop" | "photo" | "logo";

interface ImagePickerModalProps {
  entityType: ImageEntityType;
  entityId: number;
  imageType: ImageType;
  tmdbId?: number | null;
  title: string;
  onClose: () => void;
  onApplied: () => void;
}

const IMAGE_TYPE_LABEL: Record<ImageType, string> = {
  poster: "Poster",
  backdrop: "Backdrop",
  photo: "Photo",
  logo: "Logo",
};

// ============================================================================
// ImagePickerModal
// ============================================================================

export function ImagePickerModal({
  entityType,
  entityId,
  imageType,
  tmdbId,
  title,
  onClose,
  onApplied,
}: ImagePickerModalProps) {
  const [tab, setTab] = useState<"current" | "tmdb" | "local">("current");

  // Current image
  const [currentPaths, setCurrentPaths] = useState<ImagePaths | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  // TMDB candidates
  const [candidates, setCandidates] = useState<TmdbImageCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null); // tmdb_path being applied

  // Local file
  const [localDragOver, setLocalDragOver] = useState(false);
  const [localApplying, setLocalApplying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Load current image on mount
  useEffect(() => {
    getImagePaths(entityType, entityId, imageType).then((paths) => {
      setCurrentPaths(paths);
      if (paths) {
        const p = paths.medium ?? paths.large ?? paths.thumbnail;
        if (p) setCurrentUrl(convertFileSrc(p));
      }
    }).catch(() => {});
  }, [entityType, entityId, imageType]);

  // Load TMDB candidates when switching to TMDB tab
  useEffect(() => {
    if (tab !== "tmdb" || !tmdbId) return;
    setLoadingCandidates(true);
    setCandidateError(null);
    getTmdbImageCandidates(entityType, tmdbId)
      .then((list) => {
        // Filter to the relevant image type
        setCandidates(list.filter((c) => c.image_type === imageType));
      })
      .catch((e) => setCandidateError(String(e)))
      .finally(() => setLoadingCandidates(false));
  }, [tab, entityType, tmdbId, imageType]);

  // Apply a TMDB image
  const applyTmdb = useCallback(async (candidate: TmdbImageCandidate) => {
    setApplying(candidate.tmdb_path);
    try {
      const paths = await applyTmdbImage(entityType, entityId, imageType, candidate.tmdb_path);
      const p = paths.medium ?? paths.large ?? paths.thumbnail;
      if (p) setCurrentUrl(convertFileSrc(p));
      setCurrentPaths(paths);
      setTab("current");
      onApplied();
    } catch (e) {
      alert(`Erreur : ${e}`);
    } finally {
      setApplying(null);
    }
  }, [entityType, entityId, imageType, onApplied]);

  // Apply a local file
  const applyLocal = useCallback(async (filePath: string) => {
    setLocalApplying(true);
    setLocalError(null);
    try {
      const paths = await importLocalImage(entityType, entityId, imageType, filePath);
      const p = paths.medium ?? paths.large ?? paths.thumbnail;
      if (p) setCurrentUrl(convertFileSrc(p));
      setCurrentPaths(paths);
      setTab("current");
      onApplied();
    } catch (e) {
      setLocalError(String(e));
    } finally {
      setLocalApplying(false);
    }
  }, [entityType, entityId, imageType, onApplied]);

  const browseLocal = useCallback(async () => {
    try {
      const selected = await invoke<string | null>("plugin:dialog|open", {
        multiple: false,
        directory: false,
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }],
      });
      if (selected) await applyLocal(selected);
    } catch (e) {
      setLocalError(String(e));
    }
  }, [applyLocal]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setLocalDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const entry = e.dataTransfer.items[0]?.webkitGetAsEntry?.();
    const path = (entry as { fullPath?: string } | null)?.fullPath ?? null;
    if (path) await applyLocal(path);
    else setLocalError("Impossible de lire le chemin du fichier.");
  }, [applyLocal]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Supprimer l'image ${IMAGE_TYPE_LABEL[imageType]} ?`)) return;
    try {
      await deleteEntityImage(entityType, entityId, imageType);
      setCurrentUrl(null);
      setCurrentPaths(null);
      onApplied();
    } catch (e) {
      alert(`Erreur : ${e}`);
    }
  }, [entityType, entityId, imageType, onApplied]);

  return (
    // Backdrop
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Modal */}
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: 12,
          width: 680,
          maxWidth: "95vw",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            gap: 10,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>
              {IMAGE_TYPE_LABEL[imageType]} — {title}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {entityType}#{entityId}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid var(--border)",
            padding: "0 20px",
          }}
        >
          {(["current", "tmdb", "local"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "none",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--color-primary)" : "2px solid transparent",
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "var(--color-primary)" : "var(--text-muted)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t === "current" ? "Image actuelle" : t === "tmdb" ? "Depuis TMDB" : "Depuis le disque"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {tab === "current" && (
            <CurrentTab
              title={title}
              imageType={imageType}
              currentUrl={currentUrl}
              onDelete={currentPaths ? handleDelete : undefined}
              onGoTmdb={tmdbId ? () => setTab("tmdb") : undefined}
              onGoLocal={() => setTab("local")}
            />
          )}
          {tab === "tmdb" && (
            <TmdbTab
              candidates={candidates}
              loading={loadingCandidates}
              error={candidateError}
              applying={applying}
              hasTmdbId={!!tmdbId}
              onApply={applyTmdb}
            />
          )}
          {tab === "local" && (
            <LocalTab
              dragOver={localDragOver}
              applying={localApplying}
              error={localError}
              onDragOver={(e) => { e.preventDefault(); setLocalDragOver(true); }}
              onDragLeave={() => setLocalDragOver(false)}
              onDrop={onDrop}
              onBrowse={browseLocal}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CurrentTab
// ============================================================================

function CurrentTab({
  title,
  imageType,
  currentUrl,
  onDelete,
  onGoTmdb,
  onGoLocal,
}: {
  title: string;
  imageType: ImageType;
  currentUrl: string | null;
  onDelete?: () => void;
  onGoTmdb?: () => void;
  onGoLocal: () => void;
}) {
  const isPortrait = imageType === "poster" || imageType === "photo";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      {/* Current image preview */}
      <div
        style={{
          width: isPortrait ? 180 : 320,
          height: isPortrait ? 270 : 180,
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--bg-main)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>
            Aucune image<br />enregistrée
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {onGoTmdb && (
          <button onClick={onGoTmdb} style={btnStyle("primary")}>
            Choisir sur TMDB
          </button>
        )}
        <button onClick={onGoLocal} style={btnStyle("secondary")}>
          Importer depuis le disque
        </button>
        {onDelete && (
          <button onClick={onDelete} style={btnStyle("danger")}>
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TmdbTab
// ============================================================================

function TmdbTab({
  candidates,
  loading,
  error,
  applying,
  hasTmdbId,
  onApply,
}: {
  candidates: TmdbImageCandidate[];
  loading: boolean;
  error: string | null;
  applying: string | null;
  hasTmdbId: boolean;
  onApply: (c: TmdbImageCandidate) => void;
}) {
  if (!hasTmdbId) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
        Cette entité n'a pas d'identifiant TMDB — impossible de charger des images TMDB.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
        Chargement des images TMDB…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: "var(--error)", padding: 16, background: "#fee2e2", borderRadius: 8 }}>
        {error}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
        Aucune image disponible sur TMDB.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: 12,
      }}
    >
      {candidates.map((c) => {
        const isApplying = applying === c.tmdb_path;
        return (
          <div
            key={c.tmdb_path}
            style={{
              position: "relative",
              borderRadius: 8,
              overflow: "hidden",
              border: "2px solid var(--border)",
              cursor: isApplying ? "wait" : "pointer",
              transition: "border-color 0.15s, transform 0.1s",
            }}
            onClick={() => !applying && onApply(c)}
            onMouseEnter={(e) => {
              if (!applying) e.currentTarget.style.borderColor = "var(--color-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <img
              src={c.preview_url}
              alt=""
              style={{
                width: "100%",
                display: "block",
                opacity: isApplying ? 0.5 : 1,
              }}
            />
            {/* Vote badge */}
            {c.vote_average != null && c.vote_average > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "rgba(0,0,0,0.65)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 4,
                  padding: "2px 5px",
                }}
              >
                ★ {c.vote_average.toFixed(1)}
              </div>
            )}
            {isApplying && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  fontSize: 12,
                }}
              >
                …
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// LocalTab
// ============================================================================

function LocalTab({
  dragOver,
  applying,
  error,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
}: {
  dragOver: boolean;
  applying: boolean;
  error: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          width: "100%",
          maxWidth: 440,
          border: `2px dashed ${dragOver ? "var(--color-primary)" : "var(--border)"}`,
          borderRadius: 12,
          padding: "48px 24px",
          textAlign: "center",
          background: dragOver ? "var(--color-primary-soft)" : "var(--bg-main)",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>🖼</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginBottom: 6 }}>
          {applying ? "Importation…" : "Déposez une image ici"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          JPG, PNG, WEBP acceptés
        </div>
        {!applying && (
          <button onClick={onBrowse} style={btnStyle("primary")}>
            Choisir un fichier…
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            color: "var(--error)",
            background: "#fee2e2",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            maxWidth: 440,
            width: "100%",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function btnStyle(variant: "primary" | "secondary" | "danger"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "none",
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
  if (variant === "primary") return { ...base, background: "var(--color-primary)", color: "#fff" };
  if (variant === "danger") return { ...base, background: "var(--error)", color: "#fff" };
  return {
    ...base,
    background: "var(--bg-surface-alt)",
    color: "var(--text-main)",
    border: "1px solid var(--border)",
  };
}
