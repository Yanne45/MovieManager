import { useState, useRef, useEffect } from "react";
import { COLORS, SP, FONT, WEIGHT, RADIUS, flex } from "../lib/tokens";

// ============================================================================
// Filter types
// ============================================================================

export interface ActiveFilters {
  genre: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  score: string | null; // A, B, C, D
  completeness: string | null; // complete, incomplete, empty (series only)
  library: number | null;
  owned: string | null; // "yes", "no" (wishlist)
}

export const EMPTY_FILTERS: ActiveFilters = {
  genre: null,
  yearFrom: null,
  yearTo: null,
  score: null,
  completeness: null,
  library: null,
  owned: null,
};

export function hasActiveFilters(f: ActiveFilters): boolean {
  return Object.values(f).some((v) => v !== null);
}

// ============================================================================
// Filter options
// ============================================================================

interface FilterBarProps {
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  genres: { id: number; name: string }[];
  libraries: { id: number; name: string }[];
  showCompleteness?: boolean; // true for series page
}

export function FilterBar({ filters, onChange, genres, libraries, showCompleteness = false }: FilterBarProps) {
  const activeCount = Object.values(filters).filter((v) => v !== null).length;

  const update = (patch: Partial<ActiveFilters>) => onChange({ ...filters, ...patch });
  const clear = () => onChange(EMPTY_FILTERS);

  return (
    <div
      style={{
        ...flex.row,
        gap: SP.m,
        padding: `${SP.m}px ${SP.xxxl}px`,
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bgSurface,
        fontSize: FONT.base,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: COLORS.textMuted, fontWeight: WEIGHT.medium, marginRight: SP.s }}>
        Filtres
      </span>

      {/* Genre */}
      <FilterDropdown
        label="Genre"
        value={filters.genre}
        options={genres.map((g) => ({ value: g.name, label: g.name }))}
        onSelect={(v) => update({ genre: v })}
      />

      {/* Year range */}
      <YearRangeFilter
        yearFrom={filters.yearFrom}
        yearTo={filters.yearTo}
        onChange={(from, to) => update({ yearFrom: from, yearTo: to })}
      />

      {/* Score */}
      <FilterDropdown
        label="Score"
        value={filters.score}
        options={[
          { value: "A", label: "A — Excellent" },
          { value: "B", label: "B — Bon" },
          { value: "C", label: "C — Moyen" },
          { value: "D", label: "D — Faible" },
        ]}
        onSelect={(v) => update({ score: v })}
      />

      {/* Library */}
      {libraries.length > 0 && (
        <FilterDropdown
          label="Bibliothèque"
          value={filters.library?.toString() ?? null}
          options={libraries.map((l) => ({ value: l.id.toString(), label: l.name }))}
          onSelect={(v) => update({ library: v ? parseInt(v) : null })}
        />
      )}

      {/* Completeness (series only) */}
      {showCompleteness && (
        <FilterDropdown
          label="Complétude"
          value={filters.completeness}
          options={[
            { value: "complete", label: "Complètes" },
            { value: "incomplete", label: "Incomplètes" },
            { value: "empty", label: "Vides (sans fichier)" },
          ]}
          onSelect={(v) => update({ completeness: v })}
        />
      )}

      {/* Owned */}
      {!showCompleteness && (
        <FilterDropdown
          label="Possession"
          value={filters.owned}
          options={[
            { value: "yes", label: "Possédés" },
            { value: "no", label: "Recherchés" },
          ]}
          onSelect={(v) => update({ owned: v })}
        />
      )}

      {/* Clear button */}
      {activeCount > 0 && (
        <button
          onClick={clear}
          style={{
            marginLeft: SP.s,
            padding: `3px ${SP.lg}px`,
            borderRadius: RADIUS.full,
            border: "none",
            background: COLORS.primarySoft,
            color: COLORS.primary,
            fontSize: FONT.sm,
            fontWeight: WEIGHT.semi,
            cursor: "pointer",
          }}
        >
          Effacer ({activeCount})
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Dropdown component
// ============================================================================

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onSelect: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const activeOption = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: `3px ${SP.lg}px`,
          borderRadius: RADIUS.md,
          border: value ? `1px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
          background: value ? COLORS.primarySoft : "transparent",
          color: value ? COLORS.primary : COLORS.textSecondary,
          fontSize: FONT.sm,
          fontWeight: value ? WEIGHT.semi : WEIGHT.normal,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {activeOption ? `${label}: ${activeOption.label}` : label}
        <span style={{ marginLeft: SP.s, fontSize: FONT.tiny }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: SP.s,
            minWidth: 160,
            maxHeight: 240,
            overflowY: "auto",
            background: COLORS.bgSurface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.lg,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 100,
            padding: SP.s,
          }}
        >
          {/* Clear option */}
          {value && (
            <DropdownItem
              label="— Tous —"
              active={false}
              onClick={() => { onSelect(null); setOpen(false); }}
            />
          )}
          {options.map((o) => (
            <DropdownItem
              key={o.value}
              label={o.label}
              active={o.value === value}
              onClick={() => { onSelect(o.value); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: `5px ${SP.lg}px`,
        borderRadius: RADIUS.sm,
        fontSize: FONT.base,
        cursor: "pointer",
        fontWeight: active ? WEIGHT.semi : WEIGHT.normal,
        color: active ? COLORS.primary : COLORS.textMain,
        background: hover ? COLORS.bgSurfaceAlt : "transparent",
      }}
    >
      {label}
    </div>
  );
}

// ============================================================================
// Year range mini-filter
// ============================================================================

function YearRangeFilter({
  yearFrom,
  yearTo,
  onChange,
}: {
  yearFrom: number | null;
  yearTo: number | null;
  onChange: (from: number | null, to: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasValue = yearFrom !== null || yearTo !== null;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const labelText = hasValue
    ? `Année: ${yearFrom ?? "…"}–${yearTo ?? "…"}`
    : "Année";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: `3px ${SP.lg}px`,
          borderRadius: RADIUS.md,
          border: hasValue ? `1px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
          background: hasValue ? COLORS.primarySoft : "transparent",
          color: hasValue ? COLORS.primary : COLORS.textSecondary,
          fontSize: FONT.sm,
          fontWeight: hasValue ? WEIGHT.semi : WEIGHT.normal,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {labelText}
        <span style={{ marginLeft: SP.s, fontSize: FONT.tiny }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: SP.s,
            background: COLORS.bgSurface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.lg,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 100,
            padding: SP.xl,
            ...flex.rowGap(SP.base),
          }}
        >
          <input
            type="number"
            placeholder="De"
            value={yearFrom ?? ""}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null, yearTo)}
            style={{
              width: 70,
              padding: `${SP.s}px ${SP.m}px`,
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bgSurfaceAlt,
              fontSize: FONT.base,
              color: COLORS.textMain,
            }}
          />
          <span style={{ color: COLORS.textMuted, fontSize: FONT.sm }}>à</span>
          <input
            type="number"
            placeholder="À"
            value={yearTo ?? ""}
            onChange={(e) => onChange(yearFrom, e.target.value ? parseInt(e.target.value) : null)}
            style={{
              width: 70,
              padding: `${SP.s}px ${SP.m}px`,
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bgSurfaceAlt,
              fontSize: FONT.base,
              color: COLORS.textMain,
            }}
          />
          {hasValue && (
            <button
              onClick={() => { onChange(null, null); setOpen(false); }}
              style={{
                padding: `3px ${SP.base}px`,
                borderRadius: RADIUS.sm,
                border: "none",
                background: "var(--score-d-bg)",
                color: "var(--score-d-text)",
                fontSize: FONT.xs,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
