import { PosterThumb } from "./ui";
import { useImage } from "../lib/useImage";
import { tmdbImageUrl } from "../lib/api";

interface SmartPosterProps {
  entityType: "movie" | "series" | "season" | "episode";
  entityId: number;
  title: string;
  tmdbPosterPath: string | null;
  size?: "small" | "medium" | "large";
  color?: string;
}

/**
 * Displays the best available poster:
 * 1. Local cached image (via useImage hook)
 * 2. TMDB URL fallback (via tmdbImageUrl)
 * 3. Colored placeholder with initials
 */
export function SmartPoster({
  entityType,
  entityId,
  title,
  tmdbPosterPath,
  size = "small",
  color,
}: SmartPosterProps) {
  // Try local cache first
  const tmdbSize = size === "small" ? "w92" : size === "medium" ? "w342" : "w500";
  const cacheSize = size === "small" ? "thumbnail" : size === "large" ? "large" : "medium";
  const cachedUrl = useImage(entityType, entityId, "poster", cacheSize);

  // Determine best URL
  const posterUrl = cachedUrl || tmdbImageUrl(tmdbPosterPath, tmdbSize);

  return (
    <PosterThumb
      title={title}
      posterUrl={posterUrl}
      size={size}
      color={color}
    />
  );
}
