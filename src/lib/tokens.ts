/** Design system constants for use in TypeScript/JSX */

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

export const SIZES = {
  sidebarWidth: 200,
  topbarHeight: 48,
  detailPanelWidth: 320,
  radius: 8,
} as const;
