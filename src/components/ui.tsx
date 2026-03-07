import { useState, type ReactNode } from "react";
import { SCORE_STYLES, STATUS_STYLES } from "../lib/tokens";

// ============================================================================
// Score Badge (A/B/C/D)
// ============================================================================

interface ScoreBadgeProps {
  score: string | null;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  if (!score) return null;
  const style = SCORE_STYLES[score] || SCORE_STYLES.D;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 20,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        background: style.bg,
        color: style.text,
      }}
    >
      {score}
    </span>
  );
}

// ============================================================================
// Status Badge (ongoing / ended / cancelled / archived)
// ============================================================================

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.ongoing;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: style.bg,
        color: style.text,
      }}
    >
      {style.label}
    </span>
  );
}

// ============================================================================
// Completeness Bar
// ============================================================================

interface CompletenessBarProps {
  owned: number;
  total: number;
  width?: number;
}

export function CompletenessBar({ owned, total, width = 80 }: CompletenessBarProps) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const color =
    pct === 100
      ? "var(--success)"
      : pct > 0
        ? "var(--warning)"
        : "var(--error)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width,
          height: 6,
          borderRadius: 3,
          background: "var(--bg-surface-alt)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 3,
            background: color,
            transition: "width 0.3s",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        {owned}/{total} ({pct}%)
      </span>
    </div>
  );
}

// ============================================================================
// Tag pill
// ============================================================================

interface TagProps {
  label: string;
  color?: string;
  onRemove?: () => void;
}

export function Tag({ label, color, onRemove }: TagProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        background: color ? `${color}18` : "var(--color-primary-soft)",
        color: color || "var(--color-primary)",
      }}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            fontSize: 14,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

// ============================================================================
// Poster Thumbnail (colored rectangle with initials when no image)
// ============================================================================

interface PosterThumbProps {
  title: string;
  posterUrl?: string | null;
  color?: string;
  size?: "small" | "medium" | "large";
}

const POSTER_SIZES = {
  small: { width: 32, height: 44, fontSize: 10 },
  medium: { width: 48, height: 66, fontSize: 12 },
  large: { width: 120, height: 165, fontSize: 24 },
};

export function PosterThumb({ title, posterUrl, color, size = "small" }: PosterThumbProps) {
  const dims = POSTER_SIZES[size];
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  if (posterUrl) {
    return (
      <img
        src={posterUrl}
        alt={title}
        style={{
          width: dims.width,
          height: dims.height,
          borderRadius: 4,
          objectFit: "cover",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        borderRadius: 4,
        background: color || "#4a5568",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.7)",
        fontSize: dims.fontSize,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ============================================================================
// Underline Input (Material-style)
// ============================================================================

interface UnderlineInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  type?: string;
}

export function UnderlineInput({
  label,
  value,
  onChange,
  disabled = false,
  type = "text",
}: UnderlineInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 500,
          color: focused ? "var(--color-primary)" : "var(--text-muted)",
          marginBottom: 4,
          transition: "color 0.15s",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "6px 0",
          fontSize: 14,
          color: disabled ? "var(--text-muted)" : "var(--text-main)",
          background: "transparent",
          border: "none",
          borderBottom: `${focused ? 2 : 1}px solid ${focused ? "var(--color-primary)" : "var(--border)"}`,
          outline: "none",
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}

// ============================================================================
// Underline Textarea
// ============================================================================

interface UnderlineTextareaProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  rows?: number;
}

export function UnderlineTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: UnderlineTextareaProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 500,
          color: focused ? "var(--color-primary)" : "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        rows={rows}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "6px 0",
          fontSize: 14,
          color: "var(--text-main)",
          background: "transparent",
          border: "none",
          borderBottom: `${focused ? 2 : 1}px solid ${focused ? "var(--color-primary)" : "var(--border)"}`,
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
          lineHeight: 1.45,
        }}
      />
    </div>
  );
}

// ============================================================================
// Tab Bar
// ============================================================================

interface TabBarProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
        padding: "0 16px",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: active === tab.id ? 600 : 400,
            color: active === tab.id ? "var(--color-primary)" : "var(--text-secondary)",
            background: "none",
            border: "none",
            borderBottom: active === tab.id
              ? "2px solid var(--color-primary)"
              : "2px solid transparent",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Section Title (uppercase muted label)
// ============================================================================

interface SectionTitleProps {
  children: ReactNode;
}

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--text-muted)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

// ============================================================================
// Loading & Error states
// ============================================================================

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: "3px solid var(--border)",
          borderTopColor: "var(--color-primary)",
          borderRadius: "50%",
          animation: "mm-spin 0.8s linear infinite",
        }}
      />
      {message && <span>{message}</span>}
      <style>{`@keyframes mm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: "var(--text-muted)",
        fontSize: 13,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--score-d-bg)",
          color: "var(--score-d-text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        !
      </div>
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 4,
            padding: "6px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
