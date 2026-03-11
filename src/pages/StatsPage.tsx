import { SectionTitle, ScoreBadge, LoadingSpinner } from "../components/ui";
import { useDashboardStats, useGenreStats, useRecentAdditions } from "../lib/hooks";
import { useMovies, useSeriesList } from "../lib/hooks";
import { COLORS, SP, FONT, WEIGHT, RADIUS, TRANSITION, flex, card } from "../lib/tokens";

// ============================================================================
// Stats Page (self-loading)
// ============================================================================

export function StatsPage() {
  const { data: dbStats, isLoading } = useDashboardStats();
  const { data: genreStats } = useGenreStats();
  const { data: recentAdditions } = useRecentAdditions();
  const { data: movies } = useMovies();
  const { data: seriesList } = useSeriesList();

  if (isLoading || !dbStats) {
    return (
      <div style={{ ...flex.center, flex: 1 }}>
        <LoadingSpinner message="Chargement des statistiques…" />
      </div>
    );
  }

  // Score distribution from loaded movies
  const scoreDistribution = (movies ?? []).reduce(
    (acc, m) => {
      const s = (m.primary_quality_score ?? "") as string;
      if (s === "A" || s === "B" || s === "C" || s === "D") acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>
  );

  // Series completeness
  const sl = seriesList ?? [];
  const seriesComplete = sl.filter((s) => s.completeness_percent >= 100).length;
  const seriesIncomplete = sl.filter((s) => s.completeness_percent > 0 && s.completeness_percent < 100).length;
  const seriesEmpty = sl.length - seriesComplete - seriesIncomplete;

  const totalSizeGb = dbStats.total_size_bytes / (1024 * 1024 * 1024);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: SP.huge }}>
      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: SP.xl,
          marginBottom: SP.mega,
        }}
      >
        <KpiCard label="Films" value={dbStats.total_movies} />
        <KpiCard label="Séries" value={dbStats.total_series} />
        <KpiCard label="Épisodes" value={dbStats.total_episodes} />
        <KpiCard label="Fichiers" value={dbStats.total_files} />
        <KpiCard
          label="Espace disque"
          value={totalSizeGb >= 1000 ? `${(totalSizeGb / 1000).toFixed(2)} To` : `${totalSizeGb.toFixed(1)} Go`}
        />
        <KpiCard
          label="Inbox"
          value={dbStats.inbox_pending}
          accent={dbStats.inbox_pending > 0 ? COLORS.warning : undefined}
        />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xxxl }}>
        {/* Score distribution */}
        <div style={{ ...card.base, padding: SP.xxxl }}>
          <SectionTitle>Répartition par score qualité</SectionTitle>
          <div style={{ marginTop: SP.xl }}>
            {(["A", "B", "C", "D"] as const).map((grade) => {
              const count = scoreDistribution[grade] || 0;
              const total = scoreDistribution.A + scoreDistribution.B + scoreDistribution.C + scoreDistribution.D;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={grade} style={{ ...flex.rowGap(SP.lg), marginBottom: SP.lg }}>
                  <ScoreBadge score={grade} />
                  <div style={{ flex: 1, height: SP.base, borderRadius: RADIUS.sm, background: COLORS.bgSurfaceAlt, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: RADIUS.sm,
                        background: COLORS.primary,
                        transition: `width ${TRANSITION.slow}`,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: FONT.base, color: COLORS.textMuted, minWidth: 50, textAlign: "right" }}>
                    {count} ({pct.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Series completeness */}
        <div style={{ ...card.base, padding: SP.xxxl }}>
          <SectionTitle>Complétude des séries</SectionTitle>
          <div style={{ marginTop: SP.xl, ...flex.center, gap: SP.xxxl }}>
            <CompletePie complete={seriesComplete} incomplete={seriesIncomplete} total={sl.length} />
            <div style={{ fontSize: FONT.base, color: COLORS.textSecondary }}>
              <div style={{ marginBottom: SP.base }}>
                <span style={{ color: COLORS.success, fontWeight: WEIGHT.semi, marginRight: SP.m }}>●</span>
                {seriesComplete} série{seriesComplete !== 1 ? "s" : ""} complète{seriesComplete !== 1 ? "s" : ""}
              </div>
              <div style={{ marginBottom: SP.base }}>
                <span style={{ color: COLORS.warning, fontWeight: WEIGHT.semi, marginRight: SP.m }}>●</span>
                {seriesIncomplete} série{seriesIncomplete !== 1 ? "s" : ""} incomplète{seriesIncomplete !== 1 ? "s" : ""}
              </div>
              <div>
                <span style={{ color: COLORS.textMuted, fontWeight: WEIGHT.semi, marginRight: SP.m }}>●</span>
                {seriesEmpty} série{seriesEmpty !== 1 ? "s" : ""} vide{seriesEmpty !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Genre distribution + Recent additions — side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xxxl, marginTop: SP.xxxl }}>
        {/* Genre distribution */}
        {genreStats && genreStats.length > 0 && (
          <div style={{ ...card.base, padding: SP.xxxl }}>
            <SectionTitle>Top genres</SectionTitle>
            <div style={{ marginTop: SP.xl }}>
              {genreStats.map(([name, count]) => {
                const maxCount = genreStats[0]?.[1] ?? 1;
                const pct = (count / maxCount) * 100;
                return (
                  <div key={name} style={{ ...flex.rowGap(SP.lg), marginBottom: SP.base }}>
                    <span style={{ fontSize: FONT.base, fontWeight: WEIGHT.medium, minWidth: 100 }}>{name}</span>
                    <div style={{ flex: 1, height: SP.m, borderRadius: RADIUS.sm, background: COLORS.bgSurfaceAlt, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          borderRadius: RADIUS.sm,
                          background: COLORS.primarySoft,
                          transition: `width ${TRANSITION.slow}`,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: FONT.sm, color: COLORS.textMuted, minWidth: 30, textAlign: "right" }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent additions */}
        <div style={{ ...card.base, padding: SP.xxxl }}>
          <SectionTitle>Ajouts récents</SectionTitle>
          {(!recentAdditions || recentAdditions.length === 0) ? (
            <p style={{ fontSize: FONT.base, color: COLORS.textMuted, marginTop: SP.base }}>Aucun ajout récent</p>
          ) : (
            <div style={{ marginTop: SP.base }}>
              {recentAdditions.map((item, i) => (
                <div
                  key={i}
                  style={{
                    ...flex.row,
                    padding: `${SP.base}px 0`,
                    borderBottom: i < recentAdditions.length - 1 ? `1px solid ${COLORS.border}` : "none",
                    fontSize: FONT.md,
                  }}
                >
                  <span
                    style={{
                      fontSize: FONT.xs,
                      fontWeight: WEIGHT.semi,
                      padding: `1px ${SP.m}px`,
                      borderRadius: RADIUS.sm,
                      background: item.entity_type === "movie" ? COLORS.primarySoft : COLORS.bgSurfaceAlt,
                      color: item.entity_type === "movie" ? COLORS.primary : COLORS.textMuted,
                      marginRight: SP.lg,
                    }}
                  >
                    {item.entity_type === "movie" ? "Film" : "Série"}
                  </span>
                  <span style={{ flex: 1, fontWeight: WEIGHT.medium }}>{item.title}</span>
                  <span style={{ fontSize: FONT.sm, color: COLORS.textMuted }}>{item.created_at?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card.base, padding: SP.xxxl, textAlign: "center" }}>
      <div style={{ fontSize: FONT.sm, fontWeight: WEIGHT.medium, color: COLORS.textMuted, marginBottom: SP.m }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: WEIGHT.semi, color: accent || COLORS.textMain }}>{value}</div>
    </div>
  );
}

function CompletePie({ complete, incomplete, total }: { complete: number; incomplete: number; total: number }) {
  const size = 80;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const pctComplete = total > 0 ? complete / total : 0;
  const pctIncomplete = total > 0 ? incomplete / total : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-surface-alt)" strokeWidth={10} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--warning)" strokeWidth={10}
        strokeDasharray={`${circ * (pctComplete + pctIncomplete)} ${circ}`}
        strokeDashoffset={0} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--success)" strokeWidth={10}
        strokeDasharray={`${circ * pctComplete} ${circ}`}
        strokeDashoffset={0} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
