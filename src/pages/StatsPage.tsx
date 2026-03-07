import { SectionTitle, ScoreBadge, LoadingSpinner } from "../components/ui";
import { useDashboardStats, useGenreStats, useRecentAdditions } from "../lib/hooks";
import { useMovies, useSeriesList } from "../lib/hooks";

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
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
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
          accent={dbStats.inbox_pending > 0 ? "var(--warning)" : undefined}
        />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Score distribution */}
        <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <SectionTitle>Répartition par score qualité</SectionTitle>
          <div style={{ marginTop: 12 }}>
            {(["A", "B", "C", "D"] as const).map((grade) => {
              const count = scoreDistribution[grade] || 0;
              const total = scoreDistribution.A + scoreDistribution.B + scoreDistribution.C + scoreDistribution.D;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={grade} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <ScoreBadge score={grade} />
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--bg-surface-alt)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: "var(--color-primary)",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 50, textAlign: "right" }}>
                    {count} ({pct.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Series completeness */}
        <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <SectionTitle>Complétude des séries</SectionTitle>
          <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
            <CompletePie complete={seriesComplete} incomplete={seriesIncomplete} total={sl.length} />
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: "var(--success)", fontWeight: 600, marginRight: 6 }}>●</span>
                {seriesComplete} série{seriesComplete !== 1 ? "s" : ""} complète{seriesComplete !== 1 ? "s" : ""}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: "var(--warning)", fontWeight: 600, marginRight: 6 }}>●</span>
                {seriesIncomplete} série{seriesIncomplete !== 1 ? "s" : ""} incomplète{seriesIncomplete !== 1 ? "s" : ""}
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", fontWeight: 600, marginRight: 6 }}>●</span>
                {seriesEmpty} série{seriesEmpty !== 1 ? "s" : ""} vide{seriesEmpty !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Genre distribution */}
      {genreStats && genreStats.length > 0 && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <SectionTitle>Top genres</SectionTitle>
          <div style={{ marginTop: 12 }}>
            {genreStats.map(([name, count]) => {
              const maxCount = genreStats[0]?.[1] ?? 1;
              const pct = (count / maxCount) * 100;
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, minWidth: 100 }}>{name}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-surface-alt)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: 3,
                        background: "var(--color-primary-soft)",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 30, textAlign: "right" }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent additions */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <SectionTitle>Ajouts récents</SectionTitle>
        {(!recentAdditions || recentAdditions.length === 0) ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Aucun ajout récent</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {recentAdditions.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: i < recentAdditions.length - 1 ? "1px solid var(--border)" : "none",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: item.entity_type === "movie" ? "var(--color-primary-soft)" : "var(--bg-surface-alt)",
                    color: item.entity_type === "movie" ? "var(--color-primary)" : "var(--text-muted)",
                    marginRight: 10,
                  }}
                >
                  {item.entity_type === "movie" ? "Film" : "Série"}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>{item.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.created_at?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: accent || "var(--text-main)" }}>{value}</div>
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
