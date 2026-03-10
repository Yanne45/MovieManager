import { useState, useEffect, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageRecord } from "../lib/api";

interface LightboxModalProps {
  images: ImageRecord[];
  initialIndex: number;
  onClose: () => void;
}

export function LightboxModal({ images, initialIndex, onClose }: LightboxModalProps) {
  const [index, setIndex] = useState(initialIndex);
  const count = images.length;

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : count - 1));
  }, [count]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < count - 1 ? i + 1 : 0));
  }, [count]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  // Preload adjacent images
  useEffect(() => {
    for (const offset of [-1, 1]) {
      const idx = index + offset;
      if (idx >= 0 && idx < count) {
        const src = images[idx].path_large ?? images[idx].path_medium;
        if (src) {
          const img = new Image();
          img.src = convertFileSrc(src);
        }
      }
    }
  }, [index, images, count]);

  if (count === 0) return null;

  const current = images[index];
  const src = current.path_large ?? current.path_medium ?? current.path_thumb;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0, 0, 0, 0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(255,255,255,0.15)",
          border: "none",
          color: "#fff",
          fontSize: 24,
          width: 40,
          height: 40,
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2001,
        }}
        title="Fermer (Echap)"
      >
        ✕
      </button>

      {/* Counter */}
      {count > 1 && (
        <div
          style={{
            position: "absolute",
            top: 18,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 14,
            fontWeight: 500,
            zIndex: 2001,
            userSelect: "none",
          }}
        >
          {index + 1} / {count}
        </div>
      )}

      {/* Image type badge */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 16,
          color: "rgba(255,255,255,0.5)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          zIndex: 2001,
        }}
      >
        {current.image_type}
      </div>

      {/* Previous arrow */}
      {count > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.12)",
            border: "none",
            color: "#fff",
            fontSize: 28,
            width: 48,
            height: 48,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2001,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          title="Précédent (←)"
        >
          ‹
        </button>
      )}

      {/* Next arrow */}
      {count > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.12)",
            border: "none",
            color: "#fff",
            fontSize: 28,
            width: 48,
            height: 48,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2001,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          title="Suivant (→)"
        >
          ›
        </button>
      )}

      {/* Main image */}
      {src ? (
        <img
          src={convertFileSrc(src)}
          alt={`${current.image_type} ${index + 1}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "90vw",
            maxHeight: "90vh",
            objectFit: "contain",
            borderRadius: 4,
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            userSelect: "none",
          }}
          draggable={false}
        />
      ) : (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>
          Image non disponible
        </div>
      )}

      {/* Thumbnail strip at bottom */}
      {count > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 6,
            padding: "6px 10px",
            background: "rgba(0,0,0,0.6)",
            borderRadius: 8,
            maxWidth: "80vw",
            overflowX: "auto",
            zIndex: 2001,
          }}
        >
          {images.map((img, i) => {
            const thumbSrc = img.path_thumb ?? img.path_medium;
            return (
              <div
                key={img.id}
                onClick={() => setIndex(i)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: "pointer",
                  border: i === index ? "2px solid #fff" : "2px solid transparent",
                  opacity: i === index ? 1 : 0.6,
                  flexShrink: 0,
                  transition: "opacity 0.15s, border-color 0.15s",
                }}
              >
                {thumbSrc ? (
                  <img
                    src={convertFileSrc(thumbSrc)}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    draggable={false}
                  />
                ) : (
                  <div style={{
                    width: "100%",
                    height: "100%",
                    background: "rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 10,
                  }}>
                    ?
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
