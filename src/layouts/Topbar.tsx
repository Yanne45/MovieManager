import { type RefObject } from "react";
import { SP, FONT, WEIGHT, RADIUS, SIZES, flex } from "../lib/tokens";

interface TopbarProps {
  title: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode?: "table" | "gallery";
  onViewModeChange?: (mode: "table" | "gallery") => void;
  showViewSwitch?: boolean;
  compact?: boolean;
  onCompactToggle?: () => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  onImport?: () => void;
  searchRef?: RefObject<HTMLInputElement>;
}

export function Topbar({
  title,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  showViewSwitch = false,
  compact = false,
  onCompactToggle,
  theme,
  onThemeToggle,
  onImport,
  searchRef,
}: TopbarProps) {
  return (
    <div
      style={{
        height: SIZES.topbarHeight,
        flexShrink: 0,
        ...flex.row,
        padding: `0 ${SP.xxxl}px`,
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--header-border)",
        gap: SP.xl,
      }}
    >
      {/* Page title */}
      <span style={{ fontSize: 15, fontWeight: WEIGHT.semi, marginRight: SP.base, color: "var(--header-text)" }}>
        {title}
      </span>

      {/* Search */}
      <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
        <span
          style={{
            position: "absolute",
            left: SP.lg,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--header-text-muted)",
            fontSize: FONT.md,
            pointerEvents: "none",
          }}
        >
          ⌕
        </span>
        <input
          ref={searchRef}
          type="text"
          placeholder="Rechercher…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            padding: `${SP.m}px ${SP.xl}px ${SP.m}px 30px`,
            borderRadius: RADIUS.lg,
            border: "1px solid transparent",
            background: "var(--header-input-bg)",
            fontSize: FONT.md,
            color: "var(--header-text)",
            outline: "none",
          }}
          onFocus={(e) => {
            e.target.style.background = "var(--header-input-focus)";
            e.target.style.borderColor = "var(--header-accent)";
          }}
          onBlur={(e) => {
            e.target.style.background = "var(--header-input-bg)";
            e.target.style.borderColor = "transparent";
          }}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* View mode switch */}
      {showViewSwitch && onViewModeChange && (
        <div
          style={{
            display: "flex",
            borderRadius: RADIUS.md,
            border: "1px solid var(--header-border)",
            overflow: "hidden",
          }}
        >
          <ViewButton
            label="Tableau"
            active={viewMode === "table"}
            onClick={() => onViewModeChange("table")}
          />
          <ViewButton
            label="Galerie"
            active={viewMode === "gallery"}
            onClick={() => onViewModeChange("gallery")}
          />
        </div>
      )}

      {/* Compact toggle (only in table mode) */}
      {showViewSwitch && viewMode === "table" && onCompactToggle && (
        <button
          onClick={onCompactToggle}
          title={compact ? "Vue standard" : "Vue compacte"}
          style={{
            padding: `5px ${SP.lg}px`,
            borderRadius: RADIUS.md,
            border: "1px solid var(--header-border)",
            background: compact ? "rgba(255, 255, 255, 0.2)" : "var(--header-btn-bg)",
            color: "var(--header-text)",
            fontSize: FONT.sm,
            cursor: "pointer",
            fontWeight: compact ? WEIGHT.semi : WEIGHT.normal,
          }}
        >
          {compact ? "⊞" : "⊟"}
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={onThemeToggle}
        style={{
          padding: `5px ${SP.lg}px`,
          borderRadius: RADIUS.md,
          border: "1px solid var(--header-border)",
          background: "var(--header-btn-bg)",
          color: "var(--header-text)",
          fontSize: FONT.md,
          cursor: "pointer",
        }}
      >
        {theme === "light" ? "☀" : "☾"}
      </button>

      {/* Import */}
      {onImport && (
        <button
          onClick={onImport}
          style={{
            padding: `5px ${SP.xxl}px`,
            borderRadius: RADIUS.md,
            border: "none",
            background: "var(--header-accent)",
            color: "#0F2347",
            fontSize: FONT.base,
            fontWeight: WEIGHT.semi,
            cursor: "pointer",
          }}
        >
          Import
        </button>
      )}
    </div>
  );
}

function ViewButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: `${SP.s}px ${SP.xl}px`,
        fontSize: FONT.sm,
        fontWeight: active ? WEIGHT.semi : WEIGHT.normal,
        color: active ? "#FFFFFF" : "rgba(255, 255, 255, 0.8)",
        background: active ? "rgba(255, 255, 255, 0.2)" : "transparent",
        border: "none",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
