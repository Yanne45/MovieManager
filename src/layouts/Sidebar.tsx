import { useState, type ReactNode } from "react";
import type { DatabaseInfo, RecentDatabase } from "../lib/api";

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
        width: 200,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* App title */}
      <div
        style={{
          padding: "16px 16px 6px",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-main)",
        }}
      >
        MovieManager
      </div>

      {/* Database selector */}
      <div style={{ padding: "0 12px 10px", position: "relative" }}>
        <button
          onClick={() => setDbMenuOpen(!dbMenuOpen)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)",
            cursor: "pointer",
            fontSize: 11,
            color: "var(--text-secondary)",
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: "var(--success)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {currentDb?.name || "Aucune base"}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>▾</span>
        </button>

        {/* Dropdown menu */}
        {dbMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 12,
              right: 12,
              zIndex: 100,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
          >
            {/* Recent databases */}
            {recentDbs && recentDbs.length > 0 && (
              <>
                <div
                  style={{
                    padding: "6px 10px 4px",
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
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
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 10px",
                        border: "none",
                        background: isCurrent ? "var(--color-primary-soft)" : "transparent",
                        cursor: isCurrent ? "default" : "pointer",
                        fontSize: 12,
                        color: isCurrent ? "var(--color-primary)" : "var(--text-main)",
                        fontWeight: isCurrent ? 600 : 400,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {db.name}
                      </span>
                      {isCurrent && <span style={{ fontSize: 9, color: "var(--color-primary)" }}>●</span>}
                    </button>
                  );
                })}
              </>
            )}

            {/* Separator */}
            <div style={{ margin: "4px 8px", borderTop: "1px solid var(--border)" }} />

            {/* Actions */}
            <button
              onClick={() => { onBrowseDatabase?.(); setDbMenuOpen(false); }}
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--text-secondary)",
                textAlign: "left",
              }}
            >
              Ouvrir un fichier…
            </button>
            <button
              onClick={() => { onCreateDatabase?.(); setDbMenuOpen(false); }}
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--text-secondary)",
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

      <div style={{ margin: "4px 16px", borderBottom: "1px solid var(--border)" }} />

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
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          padding: "0 16px 6px",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
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
  const paddingLeft = 16 + indent * 16;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: `7px 16px 7px ${paddingLeft}px`,
        fontSize: indent > 0 ? 12 : 13,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--color-primary)" : "var(--text-secondary)",
        background: active ? "var(--color-primary-soft)" : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.1s",
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
            borderRadius: 9,
            background: "var(--error)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
  const paddingLeft = 16 + indent * 16;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: `7px 12px 7px ${paddingLeft}px`,
          fontSize: indent > 0 ? 12 : 13,
          fontWeight: active ? 600 : 500,
          color: active ? "var(--color-primary)" : "var(--text-secondary)",
          background: active && !open ? "var(--color-primary-soft)" : "transparent",
          cursor: "pointer",
          transition: "background 0.1s",
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
            padding: "0 4px 0 0",
            fontSize: 9,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            transition: "transform 0.15s",
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
