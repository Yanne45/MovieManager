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
import { COLORS, SP, FONT, WEIGHT, RADIUS, TRANSITION, flex } from "../lib/tokens";

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
        ...flex.center,
      }}
    >
      {/* Modal */}
      <div
        style={{
          background: COLORS.bgSurface,
          borderRadius: RADIUS.xl,
          width: 680,
          maxWidth: "95vw",
          maxHeight: "88vh",
          ...flex.col,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div
          style={{
            ...flex.rowGap(SP.lg),
            padding: `${SP.xxl}px ${SP.huge}px`,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: WEIGHT.bold, color: COLORS.textMain }}>
              {IMAGE_TYPE_LABEL[imageType]} — {title}
            </div>
            <div style={{ fontSize: FONT.base, color: COLORS.textMuted, marginTop: SP.xs }}>
              {entityType}#{entityId}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: FONT.xxl,
              cursor: "pointer",
              color: COLORS.textMuted,
              padding: `0 ${SP.s}px`,
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
            borderBottom: `1px solid ${COLORS.border}`,
            padding: `0 ${SP.huge}px`,
          }}
        >
          {(["current", "tmdb", "local"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "none",
                border: "none",
                borderBottom: tab === t ? `2px solid ${COLORS.primary}` : "2px solid transparent",
                padding: `${SP.lg}px ${SP.xxl}px`,
                fontSize: FONT.md,
                fontWeight: tab === t ? WEIGHT.semi : WEIGHT.normal,
                color: tab === t ? COLORS.primary : COLORS.textMuted,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t === "current" ? "Image actuelle" : t === "tmdb" ? "Depuis TMDB" : "Depuis le disque"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: SP.huge }}>
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
    <div style={{ ...flex.colGap(SP.huge), alignItems: "center" }}>
      {/* Current image preview */}
      <div
        style={{
          width: isPortrait ? 180 : 320,
          height: isPortrait ? 270 : 180,
          borderRadius: RADIUS.lg,
          overflow: "hidden",
          background: "var(--bg-main)",
          border: `1px solid ${COLORS.border}`,
          ...flex.center,
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
          <div style={{ fontSize: FONT.md, color: COLORS.textMuted, textAlign: "center", padding: SP.xxxl }}>
            Aucune image<br />enregistrée
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ ...flex.rowGap(SP.lg), flexWrap: "wrap", justifyContent: "center" }}>
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
      <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 40 }}>
        Cette entité n'a pas d'identifiant TMDB — impossible de charger des images TMDB.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 40 }}>
        Chargement des images TMDB…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: COLORS.error, padding: SP.xxxl, background: "#fee2e2", borderRadius: RADIUS.lg }}>
        {error}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 40 }}>
        Aucune image disponible sur TMDB.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: SP.xl,
      }}
    >
      {candidates.map((c) => {
        const isApplying = applying === c.tmdb_path;
        return (
          <div
            key={c.tmdb_path}
            style={{
              position: "relative",
              borderRadius: RADIUS.lg,
              overflow: "hidden",
              border: `2px solid ${COLORS.border}`,
              cursor: isApplying ? "wait" : "pointer",
              transition: `border-color ${TRANSITION.fast}, transform 0.1s`,
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
                  top: SP.s,
                  right: SP.s,
                  background: "rgba(0,0,0,0.65)",
                  color: "#fff",
                  fontSize: FONT.xs,
                  fontWeight: WEIGHT.semi,
                  borderRadius: RADIUS.sm,
                  padding: `${SP.xs}px 5px`,
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
                  ...flex.center,
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  fontSize: FONT.base,
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
    <div style={{ ...flex.colGap(SP.huge), alignItems: "center" }}>
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          width: "100%",
          maxWidth: 440,
          border: `2px dashed ${dragOver ? COLORS.primary : COLORS.border}`,
          borderRadius: RADIUS.xl,
          padding: `48px ${SP.mega}px`,
          textAlign: "center",
          background: dragOver ? COLORS.primarySoft : "var(--bg-main)",
          transition: `border-color ${TRANSITION.fast}, background ${TRANSITION.fast}`,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: SP.lg }}>🖼</div>
        <div style={{ fontSize: FONT.lg, fontWeight: WEIGHT.semi, color: COLORS.textMain, marginBottom: SP.m }}>
          {applying ? "Importation…" : "Déposez une image ici"}
        </div>
        <div style={{ fontSize: FONT.base, color: COLORS.textMuted, marginBottom: SP.xxxl }}>
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
            color: COLORS.error,
            background: "#fee2e2",
            borderRadius: RADIUS.lg,
            padding: `${SP.lg}px ${SP.xxl}px`,
            fontSize: FONT.md,
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
    borderRadius: RADIUS.md,
    padding: `7px ${SP.xxl}px`,
    fontSize: FONT.md,
    fontWeight: WEIGHT.medium,
    cursor: "pointer",
  };
  if (variant === "primary") return { ...base, background: COLORS.primary, color: "#fff" };
  if (variant === "danger") return { ...base, background: COLORS.error, color: "#fff" };
  return {
    ...base,
    background: COLORS.bgSurfaceAlt,
    color: COLORS.textMain,
    border: `1px solid ${COLORS.border}`,
  };
}
