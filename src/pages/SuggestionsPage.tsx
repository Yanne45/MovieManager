import { SectionTitle, EmptyState, LoadingSpinner } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import { useRecentlyAddedMovies, useIncompleteSeries, useWishlistMovies } from "../lib/hooks";
import type { SuggestionItem, IncompleteSeriesRow } from "../lib/api";
import { COLORS, SP, FONT, WEIGHT, RADIUS, TRANSITION, flex } from "../lib/tokens";

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
    <div style={{ flex: 1, overflowY: "auto", padding: `${SP.xxxl}px ${SP.mega}px` }}>

      {/* Recently added */}
      {recent && recent.length > 0 && (
        <SuggestionSection title="Récemment ajoutés" subtitle="Films ajoutés ces 30 derniers jours">
          <PosterGrid items={recent} entityType="movie" />
        </SuggestionSection>
      )}

      {/* Incomplete series */}
      {incomplete && incomplete.length > 0 && (
        <SuggestionSection title="Séries incomplètes" subtitle="Épisodes manquants à compléter">
          <div style={flex.colGap(SP.m)}>
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
      <p style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginBottom: SP.xl, marginTop: -SP.s }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function PosterGrid({ items, entityType }: { items: SuggestionItem[]; entityType: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: SP.xl }}>
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
              fontSize: FONT.sm,
              fontWeight: WEIGHT.medium,
              marginTop: SP.s,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.title}
          </div>
          {item.year && (
            <div style={{ fontSize: FONT.xs, color: COLORS.textMuted }}>{item.year}</div>
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
        ...flex.rowGap(SP.xl),
        padding: `${SP.base}px ${SP.xl}px`,
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.bgSurface,
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
        <div style={{ fontSize: FONT.md, fontWeight: WEIGHT.semi, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {series.title}
        </div>
        <div style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>
          {series.owned_episodes}/{series.total_episodes ?? "?"} épisodes — {series.missing_count} manquant{series.missing_count > 1 ? "s" : ""}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: 80, flexShrink: 0 }}>
        <div
          style={{
            height: SP.m,
            borderRadius: RADIUS.sm,
            background: COLORS.bgSurfaceAlt,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: pct === 100 ? COLORS.success : COLORS.warning,
              borderRadius: RADIUS.sm,
              transition: `width ${TRANSITION.slow}`,
            }}
          />
        </div>
        <div style={{ fontSize: FONT.xs, color: COLORS.textMuted, textAlign: "right", marginTop: SP.xs }}>
          {pct}%
        </div>
      </div>
    </div>
  );
}
