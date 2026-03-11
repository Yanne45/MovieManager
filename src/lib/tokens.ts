/** Design system constants for use in TypeScript/JSX */
import type { CSSProperties } from "react";

// ============================================================================
// Colors — reference CSS variables for theme support (light/dark)
// ============================================================================

export const COLORS = {
  primary: "var(--color-primary)",
  primaryHover: "var(--color-primary-hover)",
  primarySoft: "var(--color-primary-soft)",
  bgApp: "var(--bg-app)",
  bgSurface: "var(--bg-surface)",
  bgSurfaceAlt: "var(--bg-surface-alt)",
  textMain: "var(--text-main)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  border: "var(--border)",
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--error)",
} as const;

// ============================================================================
// Score & Status badge styles
// ============================================================================

export const SCORE_STYLES: Record<string, { bg: string; text: string }> = {
  A: { bg: "var(--score-a-bg)", text: "var(--score-a-text)" },
  B: { bg: "var(--score-b-bg)", text: "var(--score-b-text)" },
  C: { bg: "var(--score-c-bg)", text: "var(--score-c-text)" },
  D: { bg: "var(--score-d-bg)", text: "var(--score-d-text)" },
};

export const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ongoing: { bg: "var(--score-b-bg)", text: "var(--score-b-text)", label: "En cours" },
  ended: { bg: "var(--score-a-bg)", text: "var(--score-a-text)", label: "Terminée" },
  cancelled: { bg: "var(--score-d-bg)", text: "var(--score-d-text)", label: "Annulée" },
  archived: { bg: "var(--bg-surface-alt)", text: "var(--text-muted)", label: "Archivée" },
};

// ============================================================================
// Spacing scale (4px-based)
// ============================================================================

/** Spacing values in pixels (4px-based scale) */
export const SP = {
  xs: 2,
  s: 4,
  m: 6,
  base: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  xxxl: 16,
  huge: 20,
  mega: 24,
  giga: 32,
} as const;

// ============================================================================
// Typography
// ============================================================================

export const FONT = {
  tiny: 9,
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  lg: 14,
  xl: 16,
  xxl: 18,
} as const;

export const WEIGHT = {
  normal: 400,
  medium: 500,
  semi: 600,
  bold: 700,
} as const;

// ============================================================================
// Border radius
// ============================================================================

export const RADIUS = {
  sm: 3,
  md: 6,
  lg: 8,
  xl: 12,
  full: 999,
} as const;

// ============================================================================
// Layout sizes
// ============================================================================

export const SIZES = {
  sidebarWidth: 200,
  topbarHeight: 48,
  detailPanelWidth: 340,
  radius: 8,
} as const;

// ============================================================================
// Transitions
// ============================================================================

export const TRANSITION = {
  fast: "0.15s ease",
  normal: "0.2s ease",
  slow: "0.3s ease",
} as const;

// ============================================================================
// Style presets — reusable style fragments for common patterns
// ============================================================================

/** Standard 1px border */
const BORDER_STYLE = `1px solid ${COLORS.border}`;

/** Flexbox presets */
export const flex = {
  row: { display: "flex" as const, alignItems: "center" as const },
  rowGap: (gap: number): CSSProperties => ({ display: "flex", alignItems: "center", gap }),
  rowBetween: { display: "flex" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  col: { display: "flex" as const, flexDirection: "column" as const } as CSSProperties,
  colGap: (gap: number): CSSProperties => ({ display: "flex", flexDirection: "column", gap }),
  center: { display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const },
};

/** Button presets */
export const btn = {
  base: {
    borderRadius: RADIUS.md,
    fontSize: FONT.sm,
    fontWeight: WEIGHT.semi,
    cursor: "pointer",
    transition: `background ${TRANSITION.fast}, border-color ${TRANSITION.fast}`,
    border: BORDER_STYLE,
    padding: `${SP.s}px ${SP.xl}px`,
  } as CSSProperties,

  primary: {
    borderRadius: RADIUS.md,
    fontSize: FONT.sm,
    fontWeight: WEIGHT.semi,
    cursor: "pointer",
    transition: `background ${TRANSITION.fast}`,
    border: "none",
    padding: `${SP.m}px ${SP.xxxl}px`,
    background: COLORS.primary,
    color: "#fff",
  } as CSSProperties,

  ghost: {
    borderRadius: RADIUS.md,
    fontSize: FONT.sm,
    fontWeight: WEIGHT.semi,
    cursor: "pointer",
    transition: `background ${TRANSITION.fast}`,
    border: "none",
    padding: `${SP.s}px ${SP.xl}px`,
    background: "transparent",
    color: COLORS.textSecondary,
  } as CSSProperties,
};

/** Card / container presets */
export const card = {
  base: {
    borderRadius: RADIUS.md,
    border: BORDER_STYLE,
    background: COLORS.bgSurface,
    padding: `${SP.xl}px ${SP.xxl}px`,
  } as CSSProperties,

  interactive: {
    borderRadius: RADIUS.md,
    border: BORDER_STYLE,
    background: COLORS.bgSurface,
    padding: `${SP.xl}px ${SP.xxl}px`,
    cursor: "pointer",
    transition: `border-color ${TRANSITION.fast}, background ${TRANSITION.fast}`,
  } as CSSProperties,
};

/** Table cell padding */
export const cell = {
  base: { padding: `${SP.m}px ${SP.lg}px` } as CSSProperties,
  compact: { padding: `${SP.s}px ${SP.base}px` } as CSSProperties,
};

/** Table header style */
export const th = {
  base: {
    padding: `${SP.base}px ${SP.lg}px`,
    textAlign: "left" as const,
    fontWeight: WEIGHT.medium,
    color: COLORS.textSecondary,
    fontSize: FONT.base,
    borderBottom: BORDER_STYLE,
    whiteSpace: "nowrap" as const,
  } as CSSProperties,
};

/** Badge presets */
export const badge = {
  base: {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    padding: `0px ${SP.m}px`,
    borderRadius: RADIUS.sm,
    fontSize: FONT.xs,
    fontWeight: WEIGHT.semi,
  } as CSSProperties,
};

/** Input presets */
export const input = {
  base: {
    padding: `${SP.m}px ${SP.base}px`,
    borderRadius: RADIUS.md,
    border: BORDER_STYLE,
    background: COLORS.bgSurface,
    color: COLORS.textMain,
    fontSize: FONT.base,
    outline: "none",
  } as CSSProperties,

  select: {
    padding: `${SP.s}px ${SP.m}px`,
    borderRadius: RADIUS.sm,
    border: BORDER_STYLE,
    background: COLORS.bgSurface,
    color: COLORS.textMain,
    fontSize: FONT.sm,
  } as CSSProperties,
};

/** Panel (sliding detail) presets */
export const panel = {
  container: {
    width: SIZES.detailPanelWidth,
    flexShrink: 0,
    borderLeft: BORDER_STYLE,
    background: COLORS.bgSurface,
    overflowY: "auto" as const,
    transition: `margin-right 0.25s ease, opacity ${TRANSITION.normal}`,
  } as CSSProperties,
};
