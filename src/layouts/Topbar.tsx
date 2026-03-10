import { type RefObject } from "react";

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
        height: 48,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--header-border)",
        gap: 12,
      }}
    >
      {/* Page title */}
      <span style={{ fontSize: 15, fontWeight: 600, marginRight: 8, color: "var(--header-text)" }}>
        {title}
      </span>

      {/* Search */}
      <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
        <span
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--header-text-muted)",
            fontSize: 13,
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
            padding: "6px 12px 6px 30px",
            borderRadius: 8,
            border: "1px solid transparent",
            background: "var(--header-input-bg)",
            fontSize: 13,
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
            borderRadius: 6,
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
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid var(--header-border)",
            background: compact ? "rgba(255, 255, 255, 0.2)" : "var(--header-btn-bg)",
            color: "var(--header-text)",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: compact ? 600 : 400,
          }}
        >
          {compact ? "⊞" : "⊟"}
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={onThemeToggle}
        style={{
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid var(--header-border)",
          background: "var(--header-btn-bg)",
          color: "var(--header-text)",
          fontSize: 13,
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
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--header-accent)",
            color: "#0F2347",
            fontSize: 12,
            fontWeight: 600,
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
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: active ? 600 : 400,
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
