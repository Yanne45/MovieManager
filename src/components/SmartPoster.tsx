import { useState, useCallback } from "react";
import type { DragEvent } from "react";
import { PosterThumb } from "./ui";
import { useImage } from "../lib/useImage";
import { tmdbImageUrl, importLocalImage } from "../lib/api";
import { ImagePickerModal } from "./ImagePickerModal";
import type { ImageEntityType, ImageType } from "./ImagePickerModal";

interface SmartPosterProps {
  entityType: ImageEntityType;
  entityId: number;
  title: string;
  /** TMDB path (e.g. "/abc.jpg") for movies/series/seasons, or photo_path/logo_path for person/studio */
  tmdbPosterPath: string | null;
  /** TMDB numeric ID — enables the TMDB image picker tab */
  tmdbId?: number | null;
  size?: "small" | "medium" | "large";
  color?: string;
  /** If true, clicking the poster opens the image picker modal */
  editable?: boolean;
}

/**
 * Displays the best available image:
 * 1. Local cached image (via useImage hook)
 * 2. TMDB URL fallback (via tmdbImageUrl)
 * 3. Colored placeholder with initials
 *
 * When `editable` is true, clicking opens the ImagePickerModal.
 * Also supports drag & drop of local image files to replace the poster.
 */
export function SmartPoster({
  entityType,
  entityId,
  title,
  tmdbPosterPath,
  tmdbId,
  size = "small",
  color,
  editable = false,
}: SmartPosterProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Derive image type from entity type
  const imageType: ImageType =
    entityType === "person" ? "photo" :
    entityType === "studio" ? "logo" :
    "poster";

  const tmdbSize = size === "small" ? "w92" : size === "medium" ? "w342" : "w500";
  const cacheSize = size === "small" ? "thumbnail" : size === "large" ? "large" : "medium";

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cachedUrl = useImage(entityType, entityId, imageType, cacheSize);
  const posterUrl = cachedUrl || tmdbImageUrl(tmdbPosterPath, tmdbSize);

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, [editable]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!editable) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Tauri exposes file.path on dropped files
    const file = files[0];
    const path = (file as File & { path?: string }).path;
    if (!path) return;

    // Check it's an image
    if (!file.type.startsWith("image/")) return;

    try {
      await importLocalImage(entityType, entityId, imageType, path);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Drop import failed:", err);
    }
  }, [editable, entityType, entityId, imageType]);

  return (
    <>
      <div
        onClick={editable ? () => setPickerOpen(true) : undefined}
        onDragOver={editable ? handleDragOver : undefined}
        onDragLeave={editable ? handleDragLeave : undefined}
        onDrop={editable ? handleDrop : undefined}
        style={{
          cursor: editable ? "pointer" : undefined,
          position: "relative",
          display: "inline-block",
          outline: dragOver ? "2px dashed var(--color-primary)" : undefined,
          outlineOffset: 2,
          borderRadius: 6,
        }}
        title={editable ? "Modifier l'image (clic ou glisser-déposer)" : undefined}
      >
        <PosterThumb
          key={refreshKey}
          title={title}
          posterUrl={posterUrl}
          size={size}
          color={color}
        />
        {editable && !dragOver && (
          <div
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              borderRadius: 4,
              fontSize: 10,
              padding: "2px 5px",
              pointerEvents: "none",
            }}
          >
            ✎
          </div>
        )}
        {dragOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(47, 111, 219, 0.15)",
              borderRadius: 6,
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-primary)" }}>
              Déposer
            </span>
          </div>
        )}
      </div>

      {pickerOpen && (
        <ImagePickerModal
          entityType={entityType}
          entityId={entityId}
          imageType={imageType}
          tmdbId={tmdbId}
          title={title}
          onClose={() => setPickerOpen(false)}
          onApplied={() => {
            setRefreshKey((k) => k + 1);
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}
