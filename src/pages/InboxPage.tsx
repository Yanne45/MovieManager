import { useState, useMemo, useCallback } from "react";
import { TabBar, SectionTitle, EmptyState, LoadingSpinner } from "../components/ui";
import * as api from "../lib/api";

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
  onSearchTmdb?: (query: string) => void;
}

// ============================================================================
// Inbox Page
// ============================================================================

export function InboxPage({ items, onResolve }: InboxPageProps) {
  const [tab, setTab] = useState("pending");

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const resolved = useMemo(() => items.filter((i) => i.status !== "pending"), [items]);

  const displayed = tab === "pending" ? pending : resolved;

  const categoryGroups = useMemo(() => {
    const groups: Record<string, InboxItem[]> = {};
    for (const item of displayed) {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [displayed]);

  const CATEGORY_LABELS: Record<string, string> = {
    unrecognized: "Fichiers non reconnus",
    low_confidence: "Confiance faible",
    conflict: "Conflits de numérotation",
    placeholder: "Séries placeholder",
    dropped: "Fichiers importés",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TabBar
        tabs={[
          { id: "pending", label: `En attente (${pending.length})` },
          { id: "resolved", label: `Traités (${resolved.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {Object.entries(categoryGroups).length === 0 && (
          <EmptyState message={tab === "pending" ? "Aucun élément en attente" : "Aucun élément traité"} />
        )}

        {Object.entries(categoryGroups).map(([category, groupItems]) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <SectionTitle>{CATEGORY_LABELS[category] || category}</SectionTitle>

            {groupItems.map((item) => (
              <InboxCard key={item.id} item={item} onResolve={onResolve} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Inbox Card (with inline TMDB search)
// ============================================================================

function InboxCard({
  item,
  onResolve,
}: {
  item: InboxItem;
  onResolve?: (id: number, action: "link" | "ignore", tmdbId?: number, entityType?: "movie" | "series") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const candidates = parseCandidates(item.match_candidates);

  const fileName = item.file_path
    ? item.file_path.split(/[/\\]/).pop()
    : item.parsed_title || "Fichier inconnu";

  // Determine if this is a series item (has season/episode info)
  const isSeries = item.parsed_season != null || item.parsed_episode != null;

  return (
    <div
      style={{
        padding: "12px 14px",
        marginBottom: 8,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CategoryBadge category={item.category} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
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
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {item.created_at?.slice(0, 10)}
        </span>
      </div>

      {/* Existing candidates from auto-match */}
      {candidates.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-primary)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {expanded ? "▾ Masquer" : "▸ Voir"} {candidates.length} candidat{candidates.length > 1 ? "s" : ""}
          </button>

          {expanded && (
            <div style={{ marginTop: 8 }}>
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
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "none",
              background: "var(--color-primary)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Rechercher TMDB
          </button>
          <button
            onClick={() => onResolve?.(item.id, "ignore")}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 11,
              cursor: "pointer",
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
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
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
        marginTop: 10,
        padding: 12,
        borderRadius: 8,
        background: "var(--bg-surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Search form */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        {/* Type toggle */}
        <div style={{ display: "flex", borderRadius: 4, border: "1px solid var(--border)", overflow: "hidden" }}>
          <TypeButton label="Film" active={searchType === "movie"} onClick={() => setSearchType("movie")} />
          <TypeButton label="Série" active={searchType === "series"} onClick={() => setSearchType("series")} />
        </div>

        {/* Query */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Titre…"
          style={{
            flex: 1,
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            fontSize: 12,
            color: "var(--text-main)",
            outline: "none",
          }}
          autoFocus
        />

        {/* Year */}
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Année"
          style={{
            width: 65,
            padding: "5px 6px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            fontSize: 12,
            color: "var(--text-main)",
          }}
        />

        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-primary)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            opacity: !query.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "…" : "Chercher"}
        </button>

        <button
          onClick={onClose}
          style={{
            padding: "5px 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ padding: 16, textAlign: "center" }}>
          <LoadingSpinner message="Recherche en cours…" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
          Aucun résultat trouvé
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
                gap: 10,
                padding: "8px 10px",
                borderRadius: 6,
                marginBottom: 4,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              {/* Mini poster */}
              {r.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${r.posterPath}`}
                  alt=""
                  style={{ width: 36, height: 54, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 54,
                    borderRadius: 4,
                    background: "var(--bg-surface-alt)",
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {r.title}
                  {r.year && <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>({r.year})</span>}
                </div>
                {r.overview && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.3 }}>
                    {r.overview}{r.overview.length >= 120 ? "…" : ""}
                  </div>
                )}
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                  TMDB #{r.id} · {r.type === "movie" ? "Film" : "Série"}
                </div>
              </div>

              {/* Link button */}
              <button
                onClick={() => onLink(r.id, r.type)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  border: "none",
                  background: "var(--color-primary)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
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
        display: "flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 6,
        marginBottom: 4,
        background: "var(--bg-surface-alt)",
        gap: 10,
      }}
    >
      <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{title}</span>
      {year && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{year}</span>}
      <ConfidenceBadge value={confidence} />
      <button
        onClick={onLink}
        style={{
          padding: "3px 10px",
          borderRadius: 4,
          border: "none",
          background: "var(--color-primary)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
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
        padding: "3px 10px",
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--color-primary)" : "var(--text-muted)",
        background: active ? "var(--color-primary-soft)" : "transparent",
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
    placeholder: { bg: "var(--bg-surface-alt)", text: "var(--text-muted)", label: "Placeholder" },
    dropped: { bg: "var(--score-b-bg)", text: "var(--score-b-text)", label: "Importé" },
  };
  const s = styles[category] || styles.unrecognized;

  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: s.bg,
        color: s.text,
      }}
    >
      {s.label}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 70 ? "var(--success)" : value >= 40 ? "var(--warning)" : "var(--error)";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color }}>{value}%</span>
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
