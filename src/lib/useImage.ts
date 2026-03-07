import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getImagePaths } from "./api";

/**
 * Hook to load a cached image for an entity.
 * Returns a displayable URL (via Tauri's asset protocol) or null.
 */
export function useImage(
  entityType: string,
  entityId: number | null | undefined,
  imageType: string = "poster",
  size: "thumbnail" | "medium" | "large" = "medium"
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) {
      setUrl(null);
      return;
    }

    let cancelled = false;

    getImagePaths(entityType, entityId, imageType).then((paths) => {
      if (cancelled || !paths) return;
      const path = paths[size] ?? paths.medium ?? paths.thumbnail;
      if (path) {
        setUrl(convertFileSrc(path));
      }
    }).catch(() => {
      // Image not cached yet — no problem
    });

    return () => { cancelled = true; };
  }, [entityType, entityId, imageType, size]);

  return url;
}
