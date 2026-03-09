import { useState } from "react";
import { PosterThumb } from "./ui";
import { useImage } from "../lib/useImage";
import { tmdbImageUrl } from "../lib/api";
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

  return (
    <>
      <div
        onClick={editable ? () => setPickerOpen(true) : undefined}
        style={{
          cursor: editable ? "pointer" : undefined,
          position: "relative",
          display: "inline-block",
        }}
        title={editable ? `Modifier l'image` : undefined}
      >
        <PosterThumb
          key={refreshKey}
          title={title}
          posterUrl={posterUrl}
          size={size}
          color={color}
        />
        {editable && (
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
