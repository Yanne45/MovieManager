import { useState } from "react";
import { TabBar, EmptyState, LoadingSpinner } from "../components/ui";
import { useExactDuplicates, useProbableDuplicates, useMultiVersionMovies } from "../lib/hooks";
import type { DuplicateGroup } from "../lib/api";
import { COLORS, SP, FONT, WEIGHT, RADIUS, flex } from "../lib/tokens";

// ============================================================================
// Duplicates Page
// ============================================================================

export function DuplicatesPage() {
  const [tab, setTab] = useState("exact");

  const { data: exact, isLoading: loadingExact } = useExactDuplicates();
  const { data: probable, isLoading: loadingProbable } = useProbableDuplicates();
  const { data: multiVersion, isLoading: loadingMulti } = useMultiVersionMovies();

  const isLoading = loadingExact || loadingProbable || loadingMulti;

  const tabs = [
    { id: "exact", label: `Doublons exacts (${exact?.length ?? 0})` },
    { id: "probable", label: `Doublons probables (${probable?.length ?? 0})` },
    { id: "multi", label: `Multi-versions (${multiVersion?.length ?? 0})` },
  ];

  const displayed =
    tab === "exact" ? exact :
    tab === "probable" ? probable :
    multiVersion;

  return (
    <div style={{ flex: 1, ...flex.col, overflow: "hidden" }}>
      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      <div style={{ flex: 1, overflowY: "auto", padding: `${SP.xxxl}px ${SP.huge}px` }}>
        {isLoading && <LoadingSpinner message="Analyse des doublons…" />}

        {!isLoading && (!displayed || displayed.length === 0) && (
          <EmptyState
            message={
              tab === "exact"
                ? "Aucun doublon exact détecté (même hash SHA256)"
                : tab === "probable"
                ? "Aucun doublon probable détecté (titre + année identiques)"
                : "Aucun film avec plusieurs versions"
            }
          />
        )}

        {!isLoading && displayed && displayed.length > 0 && (
          <div>
            <TabDescription tab={tab} count={displayed.length} />
            {displayed.map((group, i) => (
              <DuplicateCard key={i} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function TabDescription({ tab, count }: { tab: string; count: number }) {
  const desc =
    tab === "exact"
      ? `${count} groupe(s) de fichiers avec un hash SHA256 identique. Ces fichiers sont des copies exactes.`
      : tab === "probable"
      ? `${count} groupe(s) de films ayant le même titre et la même année. Ils pourraient être des doublons ou des versions différentes à fusionner.`
      : `${count} film(s) possédant plusieurs versions (1080p, 4K, Director's Cut…). C'est normal dans une collection multi-versions.`;

  return (
    <p style={{ fontSize: FONT.base, color: COLORS.textMuted, marginBottom: SP.xxxl, lineHeight: 1.5 }}>
      {desc}
    </p>
  );
}

function DuplicateCard({ group }: { group: DuplicateGroup }) {
  const isExact = group.match_type === "exact";
  const isProbable = group.match_type === "probable";

  const borderColor = isExact
    ? COLORS.error
    : isProbable
    ? COLORS.warning
    : COLORS.primary;

  const badgeStyle = {
    exact: { bg: "var(--score-d-bg)", text: "var(--score-d-text)", label: "Exact" },
    probable: { bg: "var(--score-c-bg)", text: "var(--score-c-text)", label: "Probable" },
    multi_version: { bg: "var(--score-b-bg)", text: "var(--score-b-text)", label: "Multi-version" },
  }[group.match_type] ?? { bg: COLORS.bgSurfaceAlt, text: COLORS.textMuted, label: group.match_type };

  const sizeStr = group.total_size > 0
    ? group.total_size > 1024 * 1024 * 1024
      ? `${(group.total_size / (1024 * 1024 * 1024)).toFixed(1)} Go`
      : `${(group.total_size / (1024 * 1024)).toFixed(0)} Mo`
    : null;

  // Parse file_names (pipe-separated)
  const names = group.file_names.split(" | ").filter(Boolean);

  return (
    <div
      style={{
        padding: `${SP.xl}px ${SP.xxl}px`,
        marginBottom: SP.base,
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${borderColor}`,
        background: COLORS.bgSurface,
      }}
    >
      <div style={{ ...flex.rowGap(SP.lg), marginBottom: SP.m }}>
        <span
          style={{
            padding: `${SP.xs}px ${SP.base}px`,
            borderRadius: RADIUS.sm,
            fontSize: FONT.xs,
            fontWeight: WEIGHT.semi,
            background: badgeStyle.bg,
            color: badgeStyle.text,
          }}
        >
          {badgeStyle.label}
        </span>
        <span style={{ fontSize: FONT.md, fontWeight: WEIGHT.semi, flex: 1 }}>
          {group.match_key}
        </span>
        <span style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
          {group.file_count} élément{group.file_count > 1 ? "s" : ""}
          {sizeStr && ` · ${sizeStr}`}
        </span>
      </div>

      {/* File list */}
      <div style={{ paddingLeft: SP.base }}>
        {names.map((name, i) => (
          <div
            key={i}
            style={{
              fontSize: FONT.sm,
              color: COLORS.textSecondary,
              padding: `${RADIUS.sm}px 0`,
              borderBottom: i < names.length - 1 ? `1px solid ${COLORS.border}` : "none",
              fontFamily: isExact ? "monospace" : "inherit",
            }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Hash preview for exact duplicates */}
      {isExact && (
        <div style={{ fontSize: FONT.xs, color: COLORS.textMuted, marginTop: SP.m, fontFamily: "monospace" }}>
          SHA256: {group.match_key.slice(0, 16)}…
        </div>
      )}
    </div>
  );
}
