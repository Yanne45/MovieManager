import { useState, type ReactNode } from "react";
import type { DatabaseInfo, RecentDatabase } from "../lib/api";
import { COLORS, SP, FONT, WEIGHT, RADIUS, SIZES, TRANSITION, flex } from "../lib/tokens";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  inboxCount?: number;
  currentDb?: DatabaseInfo | null;
  recentDbs?: RecentDatabase[];
  onOpenDatabase?: (path: string) => void;
  onCreateDatabase?: () => void;
  onBrowseDatabase?: () => void;
}

const NAV_ITEMS = [
  { id: "library", label: "Bibliothèque" },
  { id: "series", label: "Séries" },
  { id: "actors", label: "Acteurs" },
  { id: "studios", label: "Studios" },
  { id: "tags", label: "Tags" },
  { id: "collections", label: "Collections" },
];

const TOOL_ITEMS = [
  { id: "import", label: "Importer" },
  { id: "suggestions", label: "Suggestions" },
  { id: "stats", label: "Statistiques" },
  { id: "settings", label: "Paramètres" },
];

// Pages that live inside the "Réglages" collapsible group
const REGLAGES_PAGES = ["inbox", "rules", "duplicates"];

export function Sidebar({
  currentPage,
  onNavigate,
  inboxCount = 0,
  currentDb,
  recentDbs,
  onOpenDatabase,
  onCreateDatabase,
  onBrowseDatabase,
}: SidebarProps) {
  const [dbMenuOpen, setDbMenuOpen] = useState(false);
  const [reglagesOpen, setReglagesOpen] = useState(() => REGLAGES_PAGES.includes(currentPage));
  const [doublonsOpen, setDoublonsOpen] = useState(false);

  // Auto-open réglages group when navigating to a sub-page
  const isReglagesActive = REGLAGES_PAGES.includes(currentPage);
  if (isReglagesActive && !reglagesOpen) {
    setReglagesOpen(true);
  }

  return (
    <aside
      style={{
        width: SIZES.sidebarWidth,
        flexShrink: 0,
        background: COLORS.bgSurface,
        borderRight: `1px solid ${COLORS.border}`,
        ...flex.col,
        overflow: "hidden",
      }}
    >
      {/* App title */}
      <div
        style={{
          padding: `${SP.xxxl}px ${SP.xxxl}px ${SP.m}px`,
          fontSize: 15,
          fontWeight: WEIGHT.semi,
          color: COLORS.textMain,
        }}
      >
        MovieManager
      </div>

      {/* Database selector */}
      <div style={{ padding: `0 ${SP.xl}px ${SP.lg}px`, position: "relative" }}>
        <button
          onClick={() => setDbMenuOpen(!dbMenuOpen)}
          style={{
            width: "100%",
            ...flex.row,
            gap: SP.m,
            padding: `${SP.m}px ${SP.base}px`,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bgSurfaceAlt,
            cursor: "pointer",
            fontSize: FONT.sm,
            color: COLORS.textSecondary,
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: SP.base,
              height: SP.base,
              borderRadius: SP.s,
              background: COLORS.success,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: WEIGHT.medium,
            }}
          >
            {currentDb?.name || "Aucune base"}
          </span>
          <span style={{ fontSize: FONT.tiny, color: COLORS.textMuted }}>▾</span>
        </button>

        {/* Dropdown menu */}
        {dbMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: SP.xl,
              right: SP.xl,
              zIndex: 100,
              background: COLORS.bgSurface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.lg,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
          >
            {/* Recent databases */}
            {recentDbs && recentDbs.length > 0 && (
              <>
                <div
                  style={{
                    padding: `${SP.m}px ${SP.lg}px ${SP.s}px`,
                    fontSize: FONT.tiny,
                    fontWeight: WEIGHT.semi,
                    textTransform: "uppercase",
                    color: COLORS.textMuted,
                    letterSpacing: "0.05em",
                  }}
                >
                  Récentes
                </div>
                {recentDbs.slice(0, 5).map((db) => {
                  const isCurrent = db.path === currentDb?.path;
                  return (
                    <button
                      key={db.path}
                      onClick={() => {
                        if (!isCurrent) onOpenDatabase?.(db.path);
                        setDbMenuOpen(false);
                      }}
                      style={{
                        width: "100%",
                        ...flex.row,
                        gap: SP.m,
                        padding: `7px ${SP.lg}px`,
                        border: "none",
                        background: isCurrent ? COLORS.primarySoft : "transparent",
                        cursor: isCurrent ? "default" : "pointer",
                        fontSize: FONT.base,
                        color: isCurrent ? COLORS.primary : COLORS.textMain,
                        fontWeight: isCurrent ? WEIGHT.semi : WEIGHT.normal,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {db.name}
                      </span>
                      {isCurrent && <span style={{ fontSize: FONT.tiny, color: COLORS.primary }}>●</span>}
                    </button>
                  );
                })}
              </>
            )}

            {/* Separator */}
            <div style={{ margin: `${SP.s}px ${SP.base}px`, borderTop: `1px solid ${COLORS.border}` }} />

            {/* Actions */}
            <button
              onClick={() => { onBrowseDatabase?.(); setDbMenuOpen(false); }}
              style={{
                width: "100%",
                padding: `7px ${SP.lg}px`,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: FONT.base,
                color: COLORS.textSecondary,
                textAlign: "left",
              }}
            >
              Ouvrir un fichier…
            </button>
            <button
              onClick={() => { onCreateDatabase?.(); setDbMenuOpen(false); }}
              style={{
                width: "100%",
                padding: `7px ${SP.lg}px`,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: FONT.base,
                color: COLORS.textSecondary,
                textAlign: "left",
              }}
            >
              Nouvelle base…
            </button>
          </div>
        )}
      </div>

      {/* Navigation section */}
      <SidebarSection label="NAVIGATION">
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.id}
            label={item.label}
            active={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </SidebarSection>

      <div style={{ margin: `${SP.s}px ${SP.xxxl}px`, borderBottom: `1px solid ${COLORS.border}` }} />

      {/* Tools section */}
      <SidebarSection label="OUTILS">
        {TOOL_ITEMS.map((item) => (
          <SidebarItem
            key={item.id}
            label={item.label}
            active={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        {/* Réglages collapsible group */}
        <CollapsibleItem
          label="Réglages"
          open={reglagesOpen}
          onToggle={() => setReglagesOpen(!reglagesOpen)}
          active={isReglagesActive}
        >
          <SidebarItem
            label="Inbox"
            active={currentPage === "inbox"}
            onClick={() => onNavigate("inbox")}
            badge={inboxCount > 0 ? inboxCount : undefined}
            indent={1}
          />
          <SidebarItem
            label="Règles"
            active={currentPage === "rules"}
            onClick={() => onNavigate("rules")}
            indent={1}
          />

          {/* Doublons with sub-tree */}
          <CollapsibleItem
            label="Doublons"
            open={doublonsOpen}
            onToggle={() => setDoublonsOpen(!doublonsOpen)}
            active={currentPage === "duplicates"}
            indent={1}
            onClick={() => onNavigate("duplicates")}
          >
            <SidebarItem
              label="Exacts"
              active={false}
              onClick={() => onNavigate("duplicates")}
              indent={2}
            />
            <SidebarItem
              label="Probables"
              active={false}
              onClick={() => onNavigate("duplicates")}
              indent={2}
            />
            <SidebarItem
              label="Multi-versions"
              active={false}
              onClick={() => onNavigate("duplicates")}
              indent={2}
            />
          </CollapsibleItem>
        </CollapsibleItem>
      </SidebarSection>
    </aside>
  );
}

// ── Sub-components ──

function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ padding: `${SP.base}px 0` }}>
      <div
        style={{
          padding: `0 ${SP.xxxl}px ${SP.m}px`,
          fontSize: FONT.xs,
          fontWeight: WEIGHT.semi,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: COLORS.textMuted,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function SidebarItem({
  label,
  active,
  onClick,
  badge,
  indent = 0,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  indent?: number;
}) {
  const paddingLeft = SP.xxxl + indent * SP.xxxl;
  return (
    <button
      onClick={onClick}
      style={{
        ...flex.row,
        width: "100%",
        padding: `7px ${SP.xxxl}px 7px ${paddingLeft}px`,
        fontSize: indent > 0 ? FONT.base : FONT.md,
        fontWeight: active ? WEIGHT.semi : WEIGHT.normal,
        color: active ? COLORS.primary : COLORS.textSecondary,
        background: active ? COLORS.primarySoft : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        transition: `background ${TRANSITION.fast}`,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--bg-surface-alt)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            borderRadius: RADIUS.full,
            background: COLORS.error,
            color: "#fff",
            fontSize: FONT.xs,
            fontWeight: WEIGHT.bold,
            ...flex.center,
            padding: "0 5px",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function CollapsibleItem({
  label,
  open,
  onToggle,
  active,
  children,
  indent = 0,
  onClick,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  children: ReactNode;
  indent?: number;
  onClick?: () => void;
}) {
  const paddingLeft = SP.xxxl + indent * SP.xxxl;
  return (
    <div>
      <div
        style={{
          ...flex.row,
          width: "100%",
          padding: `7px ${SP.xl}px 7px ${paddingLeft}px`,
          fontSize: indent > 0 ? FONT.base : FONT.md,
          fontWeight: active ? WEIGHT.semi : WEIGHT.medium,
          color: active ? COLORS.primary : COLORS.textSecondary,
          background: active && !open ? COLORS.primarySoft : "transparent",
          cursor: "pointer",
          transition: `background ${TRANSITION.fast}`,
        }}
        onMouseEnter={(e) => {
          if (!active || open) e.currentTarget.style.background = "var(--bg-surface-alt)";
        }}
        onMouseLeave={(e) => {
          if (!active || open) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Chevron toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: `0 ${SP.s}px 0 0`,
            fontSize: FONT.tiny,
            color: COLORS.textMuted,
            ...flex.row,
            transition: `transform ${TRANSITION.fast}`,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ▶
        </button>

        {/* Label (clicking navigates if onClick provided, otherwise toggles) */}
        <span
          style={{ flex: 1 }}
          onClick={onClick || onToggle}
        >
          {label}
        </span>
      </div>

      {/* Children (collapsible) */}
      {open && children}
    </div>
  );
}
