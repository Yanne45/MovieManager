import { SectionTitle, EmptyState, LoadingSpinner } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import { useRecentlyAddedMovies, useIncompleteSeries, useWishlistMovies } from "../lib/hooks";
import type { SuggestionItem, IncompleteSeriesRow } from "../lib/api";

// ============================================================================
// Suggestions Page
// ============================================================================

export function SuggestionsPage() {
  const { data: recent, isLoading: loadingRecent } = useRecentlyAddedMovies(12);
  const { data: incomplete, isLoading: loadingIncomplete } = useIncompleteSeries(10);
  const { data: wishlist, isLoading: loadingWishlist } = useWishlistMovies(12);

  const isLoading = loadingRecent || loadingIncomplete || loadingWishlist;

  if (isLoading) return <LoadingSpinner message="Chargement des suggestions…" />;

  const hasAny = (recent?.length ?? 0) > 0 || (incomplete?.length ?? 0) > 0 || (wishlist?.length ?? 0) > 0;

  if (!hasAny) {
    return <EmptyState message="Aucune suggestion pour le moment. Ajoutez des films et séries à votre collection." />;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>

      {/* Recently added */}
      {recent && recent.length > 0 && (
        <SuggestionSection title="Récemment ajoutés" subtitle="Films ajoutés ces 30 derniers jours">
          <PosterGrid items={recent} entityType="movie" />
        </SuggestionSection>
      )}

      {/* Incomplete series */}
      {incomplete && incomplete.length > 0 && (
        <SuggestionSection title="Séries incomplètes" subtitle="Épisodes manquants à compléter">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {incomplete.map((s) => (
              <IncompleteSeriesCard key={s.id} series={s} />
            ))}
          </div>
        </SuggestionSection>
      )}

      {/* Wishlist */}
      {wishlist && wishlist.length > 0 && (
        <SuggestionSection title="Films recherchés" subtitle="Fiches créées mais pas encore acquises">
          <PosterGrid items={wishlist} entityType="movie" />
        </SuggestionSection>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SuggestionSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <SectionTitle>{title}</SectionTitle>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, marginTop: -4 }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function PosterGrid({ items, entityType }: { items: SuggestionItem[]; entityType: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {items.map((item) => (
        <div key={item.id} style={{ width: 90, textAlign: "center" }}>
          <SmartPoster
            entityType={entityType as "movie" | "series"}
            entityId={item.id}
            title={item.title}
            tmdbPosterPath={item.poster_path}
            size="small"
          />
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.title}
          </div>
          {item.year && (
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.year}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function IncompleteSeriesCard({ series }: { series: IncompleteSeriesRow }) {
  const pct = series.total_episodes
    ? Math.round((series.owned_episodes / series.total_episodes) * 100)
    : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ width: 36, flexShrink: 0 }}>
        <SmartPoster
          entityType="series"
          entityId={series.id}
          title={series.title}
          tmdbPosterPath={series.poster_path}
          size="small"
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {series.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {series.owned_episodes}/{series.total_episodes ?? "?"} épisodes — {series.missing_count} manquant{series.missing_count > 1 ? "s" : ""}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: 80, flexShrink: 0 }}>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--bg-surface-alt)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: pct === 100 ? "var(--success)" : "var(--warning)",
              borderRadius: 3,
              transition: "width 0.3s",
            }}
          />
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right", marginTop: 2 }}>
          {pct}%
        </div>
      </div>
    </div>
  );
}
