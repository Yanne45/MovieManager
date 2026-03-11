import { useState, useCallback, useRef } from "react";
import type { DragEvent, ReactNode } from "react";
import { COLORS, SP, FONT, WEIGHT, RADIUS, flex } from "../lib/tokens";

interface DropZoneProps {
  children: ReactNode;
  onDrop: (paths: string[]) => void;
  disabled?: boolean;
}

/**
 * Full-window drop zone wrapper.
 * Shows an overlay when files are dragged over the window.
 * Extracts file paths from the drop event and passes them to onDrop.
 */
export function DropZone({ children, onDrop, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current += 1;
      if (e.dataTransfer.types.includes("Files")) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    },
    []
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      // In Tauri webview, file.path gives the native filesystem path
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Tauri exposes file.path on dropped files
        const path = (file as File & { path?: string }).path;
        if (path) {
          paths.push(path);
        }
      }

      if (paths.length > 0) {
        onDrop(paths);
      }
    },
    [onDrop, disabled]
  );

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Overlay when dragging */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9999,
            ...flex.center,
            background: "rgba(47, 111, 219, 0.08)",
            border: `3px dashed ${COLORS.primary}`,
            borderRadius: RADIUS.xl,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: COLORS.bgSurface,
              padding: `${SP.mega}px 40px`,
              borderRadius: RADIUS.xl,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: FONT.xxl,
                fontWeight: WEIGHT.semi,
                color: COLORS.primary,
                margin: 0,
              }}
            >
              Déposer les fichiers ici
            </p>
            <p
              style={{
                fontSize: FONT.md,
                color: COLORS.textMuted,
                marginTop: SP.s,
              }}
            >
              Fichiers vidéo ou dossiers
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
