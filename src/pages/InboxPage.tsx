import { useState, useMemo, useCallback } from "react";
import { TabBar, SectionTitle, EmptyState, LoadingSpinner } from "../components/ui";
import * as api from "../lib/api";
import { COLORS, SP, FONT, WEIGHT, RADIUS, TRANSITION, flex, btn, badge, input } from "../lib/tokens";

// ============================================================================
// Types (inbox_items from DB)
// ============================================================================

export interface InboxItem {
  id: number;
  category: string;
  status: string;
  file_path: string | null;
  parsed_title: string | null;
  parsed_year: number | null;
  parsed_season: number | null;
  parsed_episode: string | null;
  entity_type: string | null;
  entity_id: number | null;
  match_candidates: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at?: string;
}

interface InboxPageProps {
  items: InboxItem[];
  onResolve?: (id: number, action: "link" | "ignore", tmdbId?: number, entityType?: "movie" | "series") => void;
  onBatch?: (ids: number[], action: "ignore" | "reopen" | "delete") => void;
  onSearchTmdb?: (query: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  unrecognized: "Fichiers non reconnus",
  low_confidence: "Confiance faible",
  conflict: "Conflits de numerotation",
  placeholder: "Series placeholder",
  dropped: "Fichiers importes",
};

// ============================================================================
// Inbox Page
// ============================================================================

export function InboxPage({ items, onResolve, onBatch }: InboxPageProps) {
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewData, setPreviewData] = useState<api.BatchPreview | null>(null);
  const [previewAction, setPreviewAction] = useState<"ignore" | "reopen" | "delete" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const resolved = useMemo(() => items.filter((i) => i.status !== "pending"), [items]);

  const displayed = tab === "pending" ? pending : resolved;
  const displayedIds = useMemo(() => new Set(displayed.map((i) => i.id)), [displayed]);

  // Clear selection when switching tabs
  const handleTabChange = useCallback((newTab: string) => {
    setTab(newTab);
    setSelected(new Set());
  }, []);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, InboxItem[]> = {};
    for (const item of displayed) {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [displayed]);

  // Selection helpers
  const toggleItem = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === displayedIds.size) return new Set();
      return new Set(displayedIds);
    });
  }, [displayedIds]);

  const toggleCategory = useCallback((categoryItems: InboxItem[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const catIds = categoryItems.map((i) => i.id);
      const allSelected = catIds.every((id) => next.has(id));
      if (allSelected) {
        catIds.forEach((id) => next.delete(id));
      } else {
        catIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  // Only count selected items visible in current tab
  const selectedInView = useMemo(
    () => [...selected].filter((id) => displayedIds.has(id)),
    [selected, displayedIds]
  );

  // Batch actions with preview
  const handleBatchAction = useCallback(
    async (action: "ignore" | "reopen" | "delete") => {
      if (selectedInView.length === 0) return;
      setPreviewLoading(true);
      setPreviewAction(action);
      try {
        const preview = await api.batchPreviewInbox(selectedInView);
        setPreviewData(preview);
      } catch (err) {
        console.error("Preview error:", err);
        setPreviewData(null);
        setPreviewAction(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [selectedInView]
  );

  const confirmBatch = useCallback(() => {
    if (!previewAction || selectedInView.length === 0) return;
    onBatch?.(selectedInView, previewAction);
    setSelected(new Set());
    setPreviewData(null);
    setPreviewAction(null);
  }, [previewAction, selectedInView, onBatch]);

  const cancelPreview = useCallback(() => {
    setPreviewData(null);
    setPreviewAction(null);
  }, []);

  // Available batch actions depend on the current tab
  const batchActions = tab === "pending"
    ? [{ key: "ignore" as const, label: "Ignorer la selection" }]
    : [
        { key: "reopen" as const, label: "Reouvrir la selection" },
        { key: "delete" as const, label: "Supprimer la selection" },
      ];

  return (
    <div style={{ ...flex.col, flex: 1, overflow: "hidden" }}>
      <TabBar
        tabs={[
          { id: "pending", label: `En attente (${pending.length})` },
          { id: "resolved", label: `Traites (${resolved.length})` },
        ]}
        active={tab}
        onChange={handleTabChange}
      />

      {/* Batch action bar */}
      {selectedInView.length > 0 && (
        <BatchActionBar
          count={selectedInView.length}
          actions={batchActions}
          onAction={handleBatchAction}
          loading={previewLoading}
        />
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: `${SP.xxxl}px ${SP.huge}px` }}>
        {Object.entries(categoryGroups).length === 0 && (
          <EmptyState message={tab === "pending" ? "Aucun element en attente" : "Aucun element traite"} />
        )}

        {/* Select all toggle */}
        {displayed.length > 0 && (
          <div style={{ ...flex.rowGap(SP.base), marginBottom: SP.xl }}>
            <input
              type="checkbox"
              checked={selectedInView.length === displayed.length && displayed.length > 0}
              ref={(el) => {
                if (el) el.indeterminate = selectedInView.length > 0 && selectedInView.length < displayed.length;
              }}
              onChange={toggleAll}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: FONT.base, color: COLORS.textSecondary }}>
              {selectedInView.length > 0
                ? `${selectedInView.length} / ${displayed.length} selectionne(s)`
                : "Tout selectionner"}
            </span>
          </div>
        )}

        {Object.entries(categoryGroups).map(([category, groupItems]) => {
          const catAllSelected = groupItems.every((i) => selected.has(i.id));
          const catSomeSelected = groupItems.some((i) => selected.has(i.id));
          return (
            <div key={category} style={{ marginBottom: SP.mega }}>
              <div style={{ ...flex.rowGap(SP.base), marginBottom: SP.s }}>
                <input
                  type="checkbox"
                  checked={catAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = catSomeSelected && !catAllSelected;
                  }}
                  onChange={() => toggleCategory(groupItems)}
                  style={{ cursor: "pointer" }}
                />
                <SectionTitle style={{ margin: 0 }}>
                  {CATEGORY_LABELS[category] || category} ({groupItems.length})
                </SectionTitle>
              </div>

              {groupItems.map((item) => (
                <InboxCard
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onToggle={() => toggleItem(item.id)}
                  onResolve={onResolve}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {previewData && previewAction && (
        <BatchPreviewModal
          preview={previewData}
          action={previewAction}
          onConfirm={confirmBatch}
          onCancel={cancelPreview}
        />
      )}
    </div>
  );
}

// ============================================================================
// Batch Action Bar (sticky top)
// ============================================================================

function BatchActionBar({
  count,
  actions,
  onAction,
  loading,
}: {
  count: number;
  actions: { key: "ignore" | "reopen" | "delete"; label: string }[];
  onAction: (action: "ignore" | "reopen" | "delete") => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        ...flex.rowGap(SP.xl),
        padding: `${SP.base}px ${SP.huge}px`,
        background: COLORS.primarySoft,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <span style={{ fontSize: FONT.base, fontWeight: WEIGHT.semi, color: COLORS.primary }}>
        {count} element(s) selectionne(s)
      </span>
      <div style={{ flex: 1 }} />
      {actions.map((a) => (
        <button
          key={a.key}
          onClick={() => onAction(a.key)}
          disabled={loading}
          style={{
            ...btn.base,
            padding: `${SP.s + 1}px ${SP.xxl}px`,
            border: a.key === "delete" ? `1px solid ${COLORS.error}` : `1px solid ${COLORS.border}`,
            background: a.key === "delete" ? COLORS.error : COLORS.bgSurface,
            color: a.key === "delete" ? "#fff" : COLORS.textMain,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "..." : a.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Batch Preview Modal
// ============================================================================

function BatchPreviewModal({
  preview,
  action,
  onConfirm,
  onCancel,
}: {
  preview: api.BatchPreview;
  action: "ignore" | "reopen" | "delete";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const actionLabels: Record<string, string> = {
    ignore: "Ignorer",
    reopen: "Reouvrir",
    delete: "Supprimer",
  };

  const actionColors: Record<string, string> = {
    ignore: COLORS.warning,
    reopen: COLORS.primary,
    delete: COLORS.error,
  };

  return (
    <div
      style={{
        ...flex.center,
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: COLORS.bgSurface,
          borderRadius: RADIUS.xl,
          padding: SP.mega,
          minWidth: 400,
          maxWidth: 520,
          maxHeight: "70vh",
          overflowY: "auto",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: `0 0 ${SP.xxxl}px`, fontSize: 15, fontWeight: WEIGHT.semi }}>
          Previsualisation : {actionLabels[action]}
        </h3>

        {/* Summary */}
        <div
          style={{
            padding: SP.xl,
            borderRadius: RADIUS.lg,
            background: COLORS.bgSurfaceAlt,
            marginBottom: SP.xxxl,
          }}
        >
          <div style={{ fontSize: FONT.md, fontWeight: WEIGHT.semi, marginBottom: SP.base }}>
            {preview.total} element(s) concerne(s)
          </div>

          {/* By category */}
          <div style={{ fontSize: FONT.base, color: COLORS.textSecondary, marginBottom: SP.m }}>
            Par categorie :
          </div>
          {Object.entries(preview.by_category).map(([cat, count]) => (
            <div
              key={cat}
              style={{ ...flex.rowBetween, fontSize: FONT.base, padding: `${SP.xs}px 0` }}
            >
              <span>{CATEGORY_LABELS[cat] || cat}</span>
              <span style={{ fontWeight: WEIGHT.semi }}>{count}</span>
            </div>
          ))}

          {/* By status */}
          {Object.keys(preview.by_status).length > 1 && (
            <>
              <div style={{ fontSize: FONT.base, color: COLORS.textSecondary, marginTop: SP.base, marginBottom: SP.m }}>
                Par statut :
              </div>
              {Object.entries(preview.by_status).map(([st, count]) => (
                <div
                  key={st}
                  style={{ ...flex.rowBetween, fontSize: FONT.base, padding: `${SP.xs}px 0` }}
                >
                  <span>{st === "pending" ? "En attente" : st === "resolved" ? "Resolu" : st === "ignored" ? "Ignore" : st}</span>
                  <span style={{ fontWeight: WEIGHT.semi }}>{count}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Item list */}
        <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: SP.xxxl }}>
          {preview.items.map((item) => (
            <div
              key={item.id}
              style={{
                ...flex.rowGap(SP.base),
                padding: `${SP.s}px ${SP.base}px`,
                borderRadius: RADIUS.sm,
                marginBottom: SP.xs,
                fontSize: FONT.base,
                background: COLORS.bgSurfaceAlt,
              }}
            >
              <CategoryBadge category={item.category} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.parsed_title || `#${item.id}`}
              </span>
            </div>
          ))}
        </div>

        {/* Warning for delete */}
        {action === "delete" && (
          <div style={{ fontSize: FONT.base, color: COLORS.error, marginBottom: SP.xl, fontWeight: WEIGHT.medium }}>
            Cette action est irreversible. Les elements seront supprimes definitivement.
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: SP.lg }}>
          <button
            onClick={onCancel}
            style={{
              ...btn.base,
              padding: `${SP.m}px ${SP.xxxl}px`,
              background: "transparent",
              color: COLORS.textSecondary,
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            style={{
              ...btn.primary,
              padding: `${SP.m}px ${SP.xxxl}px`,
              background: actionColors[action],
            }}
          >
            {actionLabels[action]} {preview.total} element(s)
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inbox Card (with inline TMDB search + checkbox)
// ============================================================================

function InboxCard({
  item,
  selected,
  onToggle,
  onResolve,
}: {
  item: InboxItem;
  selected: boolean;
  onToggle: () => void;
  onResolve?: (id: number, action: "link" | "ignore", tmdbId?: number, entityType?: "movie" | "series") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const candidates = parseCandidates(item.match_candidates);

  const fileName = item.file_path
    ? item.file_path.split(/[/\\]/).pop()
    : item.parsed_title || "Fichier inconnu";

  const isSeries = item.parsed_season != null || item.parsed_episode != null;

  return (
    <div
      style={{
        padding: `${SP.xl}px ${SP.xxl}px`,
        marginBottom: SP.base,
        borderRadius: RADIUS.lg,
        border: selected ? `1px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
        background: selected ? COLORS.primarySoft : COLORS.bgSurface,
        transition: `border-color ${TRANSITION.fast}, background ${TRANSITION.fast}`,
      }}
    >
      {/* Header */}
      <div style={flex.rowGap(SP.lg)}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          style={{ cursor: "pointer", flexShrink: 0 }}
        />
        <CategoryBadge category={item.category} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: FONT.md,
              fontWeight: WEIGHT.medium,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName}
          </div>
          <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.xs }}>
            {[
              item.parsed_title,
              item.parsed_year,
              item.parsed_season != null ? `S${String(item.parsed_season).padStart(2, "0")}` : null,
              item.parsed_episode ? `E${item.parsed_episode}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <span style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
          {item.created_at?.slice(0, 10)}
        </span>
      </div>

      {/* Existing candidates from auto-match */}
      {candidates.length > 0 && (
        <div style={{ marginTop: SP.lg }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              fontSize: FONT.sm,
              fontWeight: WEIGHT.medium,
              color: COLORS.primary,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {expanded ? "▾ Masquer" : "▸ Voir"} {candidates.length} candidat{candidates.length > 1 ? "s" : ""}
          </button>

          {expanded && (
            <div style={{ marginTop: SP.base }}>
              {candidates.map((c, i) => (
                <CandidateRow
                  key={i}
                  title={c.title}
                  year={c.year?.slice(0, 4) ?? null}
                  confidence={c.confidence}
                  onLink={() => onResolve?.(item.id, "link", c.tmdbId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {item.status === "pending" && (
        <div style={{ display: "flex", gap: SP.base, marginTop: SP.lg }}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{
              ...btn.primary,
              padding: `${SP.s}px ${SP.xl}px`,
            }}
          >
            Rechercher TMDB
          </button>
          <button
            onClick={() => onResolve?.(item.id, "ignore")}
            style={{
              ...btn.ghost,
              padding: `${SP.s}px ${SP.xl}px`,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            Ignorer
          </button>
        </div>
      )}

      {/* TMDB Search Panel */}
      {showSearch && item.status === "pending" && (
        <TmdbSearchPanel
          defaultQuery={item.parsed_title || ""}
          defaultYear={item.parsed_year}
          isSeries={isSeries}
          onLink={(tmdbId, type) => {
            onResolve?.(item.id, "link", tmdbId, type);
            setShowSearch(false);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Resolved note */}
      {item.status !== "pending" && item.resolution_note && (
        <div style={{ marginTop: SP.base, fontSize: FONT.sm, color: COLORS.textMuted, fontStyle: "italic" }}>
          {item.resolution_note}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TMDB Search Panel (inline in card)
// ============================================================================

function TmdbSearchPanel({
  defaultQuery,
  defaultYear,
  isSeries,
  onLink,
  onClose,
}: {
  defaultQuery: string;
  defaultYear: number | null;
  isSeries: boolean;
  onLink: (tmdbId: number, type: "movie" | "series") => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [year, setYear] = useState(defaultYear?.toString() ?? "");
  const [searchType, setSearchType] = useState<"movie" | "series">(isSeries ? "series" : "movie");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const yr = year ? parseInt(year) : undefined;
      if (searchType === "movie") {
        const r = await api.searchMovieTmdb(query.trim(), yr);
        setResults(r.map((m) => ({
          id: m.id,
          title: m.title,
          year: m.release_date?.slice(0, 4) ?? null,
          overview: m.overview?.slice(0, 120) ?? null,
          posterPath: m.poster_path,
          type: "movie" as const,
        })));
      } else {
        const r = await api.searchSeriesTmdb(query.trim(), yr);
        setResults(r.map((s) => ({
          id: s.id,
          title: s.name,
          year: s.first_air_date?.slice(0, 4) ?? null,
          overview: s.overview?.slice(0, 120) ?? null,
          posterPath: s.poster_path,
          type: "series" as const,
        })));
      }
    } catch (err) {
      console.error("TMDB search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, year, searchType]);

  return (
    <div
      style={{
        marginTop: SP.lg,
        padding: SP.xl,
        borderRadius: RADIUS.lg,
        background: COLORS.bgSurfaceAlt,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Search form */}
      <div style={{ ...flex.rowGap(SP.base), marginBottom: SP.lg }}>
        {/* Type toggle */}
        <div style={{ ...flex.row, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
          <TypeButton label="Film" active={searchType === "movie"} onClick={() => setSearchType("movie")} />
          <TypeButton label="Serie" active={searchType === "series"} onClick={() => setSearchType("series")} />
        </div>

        {/* Query */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Titre..."
          style={{
            ...input.base,
            flex: 1,
            padding: `${SP.s + 1}px ${SP.lg}px`,
          }}
          autoFocus
        />

        {/* Year */}
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Annee"
          style={{
            ...input.base,
            width: 65,
            padding: `${SP.s + 1}px ${SP.m}px`,
          }}
        />

        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{
            ...btn.primary,
            padding: `${SP.s + 1}px ${SP.xxl}px`,
            cursor: loading ? "wait" : "pointer",
            opacity: !query.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "..." : "Chercher"}
        </button>

        <button
          onClick={onClose}
          style={{
            ...btn.base,
            padding: `${SP.s + 1}px ${SP.base}px`,
            background: "transparent",
            color: COLORS.textMuted,
          }}
        >
          ✕
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ padding: SP.xxxl, textAlign: "center" }}>
          <LoadingSpinner message="Recherche en cours..." />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div style={{ padding: SP.xl, textAlign: "center", color: COLORS.textMuted, fontSize: FONT.base }}>
          Aucun resultat trouve
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
          {results.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: SP.lg,
                padding: `${SP.base}px ${SP.lg}px`,
                borderRadius: RADIUS.md,
                marginBottom: SP.s,
                background: COLORS.bgSurface,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {/* Mini poster */}
              {r.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${r.posterPath}`}
                  alt=""
                  style={{ width: 36, height: 54, borderRadius: RADIUS.sm, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 54,
                    borderRadius: RADIUS.sm,
                    background: COLORS.bgSurfaceAlt,
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: FONT.base, fontWeight: WEIGHT.semi }}>
                  {r.title}
                  {r.year && <span style={{ fontWeight: WEIGHT.normal, color: COLORS.textMuted, marginLeft: SP.m }}>({r.year})</span>}
                </div>
                {r.overview && (
                  <div style={{ fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: SP.xs, lineHeight: 1.3 }}>
                    {r.overview}{r.overview.length >= 120 ? "..." : ""}
                  </div>
                )}
                <div style={{ fontSize: FONT.xs, color: COLORS.textMuted, marginTop: SP.s }}>
                  TMDB #{r.id} · {r.type === "movie" ? "Film" : "Serie"}
                </div>
              </div>

              {/* Link button */}
              <button
                onClick={() => onLink(r.id, r.type)}
                style={{
                  ...btn.primary,
                  padding: `${SP.s}px ${SP.xl}px`,
                  fontSize: FONT.xs,
                  borderRadius: RADIUS.sm,
                  flexShrink: 0,
                  alignSelf: "center",
                }}
              >
                Lier
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Shared sub-components
// ============================================================================

function CandidateRow({
  title,
  year,
  confidence,
  onLink,
}: {
  title: string;
  year: string | null;
  confidence: number;
  onLink: () => void;
}) {
  return (
    <div
      style={{
        ...flex.rowGap(SP.lg),
        padding: `${SP.m}px ${SP.lg}px`,
        borderRadius: RADIUS.md,
        marginBottom: SP.s,
        background: COLORS.bgSurfaceAlt,
      }}
    >
      <span style={{ flex: 1, fontSize: FONT.base, fontWeight: WEIGHT.medium }}>{title}</span>
      {year && <span style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>{year}</span>}
      <ConfidenceBadge value={confidence} />
      <button
        onClick={onLink}
        style={{
          ...btn.primary,
          padding: `${SP.s}px ${SP.lg}px`,
          fontSize: FONT.xs,
          borderRadius: RADIUS.sm,
        }}
      >
        Lier
      </button>
    </div>
  );
}

function TypeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: `${SP.s}px ${SP.lg}px`,
        fontSize: FONT.xs,
        fontWeight: active ? WEIGHT.semi : WEIGHT.normal,
        color: active ? COLORS.primary : COLORS.textMuted,
        background: active ? COLORS.primarySoft : "transparent",
        border: "none",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    unrecognized: { bg: "var(--score-d-bg)", text: "var(--score-d-text)", label: "Non reconnu" },
    low_confidence: { bg: "var(--score-c-bg)", text: "var(--score-c-text)", label: "Confiance faible" },
    conflict: { bg: "var(--score-b-bg)", text: "var(--score-b-text)", label: "Conflit" },
    placeholder: { bg: COLORS.bgSurfaceAlt, text: COLORS.textMuted, label: "Placeholder" },
    dropped: { bg: "var(--score-b-bg)", text: "var(--score-b-text)", label: "Importe" },
  };
  const s = styles[category] || styles.unrecognized;

  return (
    <span
      style={{
        ...badge.base,
        padding: `${SP.xs}px ${SP.base}px`,
        background: s.bg,
        color: s.text,
      }}
    >
      {s.label}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 70 ? COLORS.success : value >= 40 ? COLORS.warning : COLORS.error;
  return (
    <span style={{ fontSize: FONT.sm, fontWeight: WEIGHT.semi, color }}>{value}%</span>
  );
}

interface Candidate {
  title: string;
  year: string | null;
  tmdbId: number;
  confidence: number;
}

function parseCandidates(json: string | null): Candidate[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// Normalized result type for display
interface TmdbResult {
  id: number;
  title: string;
  year: string | null;
  overview: string | null;
  posterPath: string | null;
  type: "movie" | "series";
}
