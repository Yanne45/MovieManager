import { useState, useMemo, useCallback, type ReactNode } from "react";
import {
  COLORS, SCORE_STYLES, STATUS_STYLES,
  SP, FONT, WEIGHT, RADIUS, TRANSITION,
  flex, btn, input as inputPreset,
} from "../lib/tokens";

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
        ...flex.center,
        width: 24,
        height: 20,
        borderRadius: RADIUS.sm,
        fontSize: FONT.sm,
        fontWeight: WEIGHT.bold,
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
        padding: `0 ${SP.base}px`,
        borderRadius: RADIUS.full,
        fontSize: FONT.sm,
        fontWeight: WEIGHT.semi,
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
      ? COLORS.success
      : pct > 0
        ? COLORS.warning
        : COLORS.error;

  return (
    <div style={flex.rowGap(SP.m)}>
      <div
        style={{
          width,
          height: 6,
          borderRadius: RADIUS.sm,
          background: COLORS.bgSurfaceAlt,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: RADIUS.sm,
            background: color,
            transition: `width ${TRANSITION.slow}`,
          }}
        />
      </div>
      <span style={{ fontSize: FONT.sm, color: COLORS.textMuted, whiteSpace: "nowrap" }}>
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
        ...flex.row,
        gap: SP.s,
        padding: `0 ${SP.lg}px`,
        borderRadius: RADIUS.full,
        fontSize: FONT.sm,
        fontWeight: WEIGHT.medium,
        background: color ? `${color}18` : COLORS.primarySoft,
        color: color || COLORS.primary,
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
            fontSize: FONT.lg,
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
  small: { width: 32, height: 44, fontSize: FONT.xs },
  medium: { width: 48, height: 66, fontSize: FONT.base },
  large: { width: 220, height: 330, fontSize: 32 },
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
          borderRadius: RADIUS.sm,
          objectFit: "cover",
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...flex.center,
        width: dims.width,
        height: dims.height,
        borderRadius: RADIUS.sm,
        background: color || "#4a5568",
        color: "rgba(255,255,255,0.7)",
        fontSize: dims.fontSize,
        fontWeight: WEIGHT.bold,
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
    <div style={{ marginBottom: SP.xxxl }}>
      <label
        style={{
          display: "block",
          fontSize: FONT.sm,
          fontWeight: WEIGHT.medium,
          color: focused ? COLORS.primary : COLORS.textMuted,
          marginBottom: SP.s,
          transition: `color ${TRANSITION.fast}`,
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
          padding: `${SP.m}px 0`,
          fontSize: FONT.lg,
          color: disabled ? COLORS.textMuted : COLORS.textMain,
          background: "transparent",
          border: "none",
          borderBottom: `${focused ? 2 : 1}px solid ${focused ? COLORS.primary : COLORS.border}`,
          outline: "none",
          transition: `border-color ${TRANSITION.fast}`,
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
    <div style={{ marginBottom: SP.xxxl }}>
      <label
        style={{
          display: "block",
          fontSize: FONT.sm,
          fontWeight: WEIGHT.medium,
          color: focused ? COLORS.primary : COLORS.textMuted,
          marginBottom: SP.s,
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
          padding: `${SP.m}px 0`,
          fontSize: FONT.lg,
          color: COLORS.textMain,
          background: "transparent",
          border: "none",
          borderBottom: `${focused ? 2 : 1}px solid ${focused ? COLORS.primary : COLORS.border}`,
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
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSurface,
        padding: `0 ${SP.xxxl}px`,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: `${SP.lg}px ${SP.xxxl}px`,
            fontSize: FONT.md,
            fontWeight: active === tab.id ? WEIGHT.semi : WEIGHT.normal,
            color: active === tab.id ? COLORS.primary : COLORS.textSecondary,
            background: "none",
            border: "none",
            borderBottom: active === tab.id
              ? `2px solid ${COLORS.primary}`
              : "2px solid transparent",
            cursor: "pointer",
            transition: `all ${TRANSITION.fast}`,
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
  style?: React.CSSProperties;
}

export function SectionTitle({ children, style }: SectionTitleProps) {
  return (
    <div
      style={{
        fontSize: FONT.xs,
        fontWeight: WEIGHT.semi,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: COLORS.textMuted,
        marginBottom: SP.m,
        ...style,
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
        ...flex.center,
        height: "100%",
        color: COLORS.textMuted,
        fontSize: FONT.md,
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
        ...flex.center,
        height: "100%",
        flexDirection: "column",
        gap: SP.xl,
        color: COLORS.textMuted,
        fontSize: FONT.md,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: `3px solid ${COLORS.border}`,
          borderTopColor: COLORS.primary,
          borderRadius: "50%",
          animation: "mm-spin 0.8s linear infinite",
        }}
      />
      {message && <span>{message}</span>}
      <style>{`@keyframes mm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================================
// Pagination
// ============================================================================

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 0] as const;
const PAGE_SIZE_LABELS: Record<number, string> = { 0: "Tout" };

export interface PaginationState<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  pageItems: T[];
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
}

export function usePagination<T>(items: T[], initialPageSize = 50): PaginationState<T> {
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);

  const setPageSize = useCallback((s: number) => {
    setPageSizeRaw(s);
    setPageRaw(1);
  }, []);

  const totalItems = items.length;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));

  const safePage = Math.min(page, totalPages);
  if (safePage !== page) setPageRaw(safePage);

  const pageItems = useMemo(() => {
    if (pageSize === 0) return items;
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    pageItems,
    setPage: setPageRaw,
    setPageSize,
  };
}

interface PaginationBarProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  if (totalItems === 0) return null;

  const pageBtnStyle: React.CSSProperties = {
    ...btn.base,
    padding: `0 ${SP.lg}px`,
    borderRadius: RADIUS.sm,
    background: COLORS.bgSurface,
    color: COLORS.textSecondary,
    fontSize: FONT.base,
  };
  const disabledBtn: React.CSSProperties = { ...pageBtnStyle, opacity: 0.4, cursor: "default" };

  return (
    <div
      style={{
        ...flex.rowBetween,
        padding: `${SP.m}px ${SP.xl}px`,
        borderTop: `1px solid ${COLORS.border}`,
        background: COLORS.bgSurfaceAlt,
        fontSize: FONT.base,
        color: COLORS.textMuted,
        flexShrink: 0,
      }}
    >
      <span>{totalItems} element{totalItems > 1 ? "s" : ""}</span>

      {totalPages > 1 && (
        <div style={flex.rowGap(SP.m)}>
          <button
            style={page <= 1 ? disabledBtn : pageBtnStyle}
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            title="Premiere page"
          >
            {"<<"}
          </button>
          <button
            style={page <= 1 ? disabledBtn : pageBtnStyle}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {"<"}
          </button>
          <span style={{ minWidth: 70, textAlign: "center" }}>
            {page} / {totalPages}
          </span>
          <button
            style={page >= totalPages ? disabledBtn : pageBtnStyle}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {">"}
          </button>
          <button
            style={page >= totalPages ? disabledBtn : pageBtnStyle}
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Derniere page"
          >
            {">>"}
          </button>
        </div>
      )}

      <div style={flex.rowGap(SP.m)}>
        <span>Par page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          style={inputPreset.select}
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {PAGE_SIZE_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        ...flex.center,
        height: "100%",
        flexDirection: "column",
        gap: SP.xl,
        color: COLORS.textMuted,
        fontSize: FONT.md,
        padding: SP.mega,
        textAlign: "center",
      }}
    >
      <div
        style={{
          ...flex.center,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--score-d-bg)",
          color: "var(--score-d-text)",
          fontSize: FONT.xxl,
          fontWeight: WEIGHT.bold,
        }}
      >
        !
      </div>
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            ...btn.base,
            marginTop: SP.s,
            padding: `${SP.m}px ${SP.xxxl}px`,
            background: COLORS.bgSurface,
            color: COLORS.textSecondary,
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
