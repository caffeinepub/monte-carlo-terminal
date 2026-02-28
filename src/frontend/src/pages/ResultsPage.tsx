import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClearSimulationHistory,
  useGetSimulationHistory,
} from "@/hooks/useQueries";

import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent, formatTimestamp } from "@/utils/format";
import type { ExtendedSimulationResult } from "@/utils/monteCarlo";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Clock,
  Loader2,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { SimulationResult, YearStats } from "../backend.d";

type DisplayMode = "nominal" | "real";

interface ResultsPageProps {
  clientId: string;
  latestResult?: ExtendedSimulationResult | SimulationResult | null;
}

interface ChartDataPoint {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  base: number;
  band1: number;
  band2: number;
  band3: number;
  band4: number;
}

function buildChartData(
  result: SimulationResult | ExtendedSimulationResult,
  mode: DisplayMode,
): ChartDataPoint[] {
  const makePoint = (
    year: number,
    p10: number,
    p25: number,
    p50: number,
    p75: number,
    p90: number,
    mean: number,
  ): ChartDataPoint => ({
    year,
    p10,
    p25,
    p50,
    p75,
    p90,
    mean,
    base: p10,
    band1: Math.max(p25 - p10, 0),
    band2: Math.max(p50 - p25, 0),
    band3: Math.max(p75 - p50, 0),
    band4: Math.max(p90 - p75, 0),
  });

  const isExtended = "yearlyStatsReal" in result;
  const iv = result.totalInitialValue;

  // For real mode, adjust the initial value too
  const extResult = isExtended ? (result as ExtendedSimulationResult) : null;
  const inflRate = extResult
    ? ((extResult.config as unknown as { inflationRate?: number })
        .inflationRate ?? 0)
    : 0;
  const ivReal = mode === "real" && inflRate > 0 ? iv : iv; // year 0 = today's dollars (no adjustment)

  const initial = makePoint(0, ivReal, ivReal, ivReal, ivReal, ivReal, ivReal);

  let stats: YearStats[];
  if (mode === "real" && isExtended && extResult?.yearlyStatsReal?.length) {
    stats = extResult.yearlyStatsReal;
  } else {
    stats = result.yearlyStats;
  }

  const yearly = stats.map((ys: YearStats) =>
    makePoint(
      Number(ys.year),
      Math.round(ys.p10),
      Math.round(ys.p25),
      Math.round(ys.p50),
      Math.round(ys.p75),
      Math.round(ys.p90),
      Math.round(ys.mean),
    ),
  );

  return [initial, ...yearly].sort((a, b) => a.year - b.year);
}

function formatYAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
}

const TRANCHES = [
  {
    key: "T5",
    label: "Bull Case",
    range: "P75–P90",
    color: "oklch(0.82 0.21 145)",
  },
  {
    key: "T4",
    label: "Above Median",
    range: "P50–P75",
    color: "oklch(0.74 0.19 145)",
  },
  { key: "T3", label: "Median", range: "P50", color: "oklch(0.78 0.19 145)" },
  {
    key: "T2",
    label: "Below Median",
    range: "P25–P50",
    color: "oklch(0.58 0.15 145)",
  },
  {
    key: "T1",
    label: "Bear Case",
    range: "P10–P25",
    color: "oklch(0.42 0.10 145)",
  },
];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: ChartDataPoint }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const raw = payload[0]?.payload as ChartDataPoint | undefined;
  if (!raw) return null;

  return (
    <div className="bg-popover border border-border rounded p-3 shadow-terminal-card font-mono text-xs min-w-[200px]">
      <p className="text-terminal-green font-bold mb-2.5 tracking-widest border-b border-border/40 pb-1.5">
        YEAR {label}
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm inline-block shrink-0"
              style={{ background: "oklch(0.82 0.21 145)" }}
            />
            <span className="text-muted-foreground">Bull Case (P90)</span>
          </span>
          <span className="text-foreground/90 data-value">
            {formatCurrency(raw.p90)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm inline-block shrink-0"
              style={{ background: "oklch(0.74 0.19 145)" }}
            />
            <span className="text-muted-foreground">Above Med (P75)</span>
          </span>
          <span className="text-foreground/90 data-value">
            {formatCurrency(raw.p75)}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-t border-border/40 pt-1.5 mt-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-[3px] rounded-sm inline-block shrink-0 mt-0.5"
              style={{ background: "oklch(0.78 0.19 145)" }}
            />
            <span className="text-foreground font-bold">Median (P50)</span>
          </span>
          <span className="text-terminal-green font-bold data-value">
            {formatCurrency(raw.p50)}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-t border-border/40 pt-1.5 mt-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm inline-block shrink-0"
              style={{ background: "oklch(0.58 0.15 145)" }}
            />
            <span className="text-muted-foreground">Below Med (P25)</span>
          </span>
          <span className="text-foreground/70 data-value">
            {formatCurrency(raw.p25)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm inline-block shrink-0"
              style={{ background: "oklch(0.42 0.10 145)" }}
            />
            <span className="text-muted-foreground">Bear Case (P10)</span>
          </span>
          <span className="text-foreground/60 data-value">
            {formatCurrency(raw.p10)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage({
  clientId,
  latestResult,
}: ResultsPageProps) {
  const { data: history, isLoading: historyLoading } =
    useGetSimulationHistory(clientId);
  const clearHistory = useClearSimulationHistory(clientId);
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("nominal");

  // Choose which result to display
  const displayResult: SimulationResult | ExtendedSimulationResult | null =
    selectedId !== null
      ? (history?.find((r) => r.id === selectedId) ?? null)
      : (latestResult ??
        (history && history.length > 0 ? history[history.length - 1] : null));

  const isExtended = displayResult && "yearlyStatsReal" in displayResult;
  const extResult = isExtended
    ? (displayResult as ExtendedSimulationResult)
    : null;

  // Extended config fields (cast since backend.d.ts may not have them)
  type ExtConfig = {
    numSimulations: bigint;
    timeHorizonYears: bigint;
    annualContribution: number;
    targetValue?: number;
    inflationRate?: number;
    taxDrag?: number;
    crashYear?: bigint;
    crashDrawdown?: number;
  };
  const extConfig: ExtConfig | null = displayResult
    ? (displayResult.config as ExtConfig)
    : null;

  const hasRealData = !!extResult?.yearlyStatsReal?.length;

  // Use real or nominal final percentiles
  const finalP10 =
    displayMode === "real" && hasRealData
      ? (extResult?.finalP10Real ?? displayResult?.finalP10 ?? 0)
      : (displayResult?.finalP10 ?? 0);
  const finalP50 =
    displayMode === "real" && hasRealData
      ? (extResult?.finalP50Real ?? displayResult?.finalP50 ?? 0)
      : (displayResult?.finalP50 ?? 0);
  const finalP75 =
    displayMode === "real" && hasRealData
      ? (extResult?.finalP75Real ?? displayResult?.finalP75 ?? 0)
      : (displayResult?.finalP75 ?? 0);
  const finalP90 =
    displayMode === "real" && hasRealData
      ? (extResult?.finalP90Real ?? displayResult?.finalP90 ?? 0)
      : (displayResult?.finalP90 ?? 0);

  const handleClearHistory = async () => {
    try {
      await clearHistory.mutateAsync();
      toast.success("Simulation history cleared");
      setSelectedId(null);
    } catch {
      toast.error("Failed to clear history");
    }
    setClearDialogOpen(false);
  };

  const chartData = displayResult
    ? buildChartData(displayResult, displayMode)
    : [];

  const hasTarget =
    displayResult?.config?.targetValue !== undefined &&
    displayResult.config.targetValue > 0;

  const profitLoss = displayResult
    ? finalP50 - displayResult.totalInitialValue
    : 0;
  const profitLossPercent = displayResult
    ? (profitLoss / displayResult.totalInitialValue) * 100
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-mono">
            <span className="text-terminal-green opacity-60">›</span>
            <span className="tracking-widest uppercase">Analysis Output</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            Simulation Results
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Nominal / Real toggle */}
          <div className="flex items-center rounded border border-border overflow-hidden font-mono text-xs">
            <button
              type="button"
              onClick={() => setDisplayMode("nominal")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                displayMode === "nominal"
                  ? "bg-terminal-green text-primary-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
              )}
            >
              Nominal
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("real")}
              className={cn(
                "px-3 py-1.5 transition-colors border-l border-border",
                displayMode === "real"
                  ? "bg-terminal-amber text-primary-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                !hasRealData && "opacity-40 cursor-not-allowed",
              )}
              disabled={!hasRealData}
              title={
                !hasRealData
                  ? "Real data only available for newly run simulations"
                  : undefined
              }
            >
              Real (Inflation-Adj.)
            </button>
          </div>

          {/* History picker */}
          {history && history.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-border text-muted-foreground hover:text-foreground font-mono text-xs gap-2"
                >
                  <Clock className="w-3.5 h-3.5" />
                  History
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-popover border-border font-mono w-64 max-h-64 overflow-y-auto"
              >
                {[...history].reverse().map((sim) => (
                  <DropdownMenuItem
                    key={String(sim.id)}
                    onClick={() => setSelectedId(sim.id)}
                    className={cn(
                      "text-xs cursor-pointer",
                      displayResult?.id === sim.id && "text-terminal-green",
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold">
                        #{String(sim.id)} —{" "}
                        {Number(sim.config.timeHorizonYears)}yr
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {formatTimestamp(sim.timestamp)} ·{" "}
                        {Number(sim.config.numSimulations).toLocaleString()}{" "}
                        paths
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            variant="outline"
            onClick={() => setClearDialogOpen(true)}
            disabled={
              clearHistory.isPending || !history || history.length === 0
            }
            className="border-terminal-red/30 text-terminal-red hover:bg-terminal-red/10 font-mono text-xs"
          >
            {clearHistory.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span className="ml-1.5 hidden sm:inline">Clear History</span>
          </Button>
        </div>
      </div>

      {/* No results state */}
      {!displayResult && !historyLoading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="font-mono text-terminal-green-dim text-5xl mb-4 opacity-20">
            ░▒▓█
          </div>
          <p className="text-muted-foreground text-sm font-mono mb-1">
            NO SIMULATION DATA
          </p>
          <p className="text-muted-foreground/40 text-xs font-mono">
            Run a simulation on the Simulate page to see results here
          </p>
        </motion.div>
      )}

      {historyLoading && !displayResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {["s1", "s2", "s3", "s4", "s5"].map((k) => (
              <Skeleton key={k} className="h-20 bg-muted/50" />
            ))}
          </div>
          <Skeleton className="h-80 bg-muted/50" />
        </div>
      )}

      {displayResult && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Display mode indicator */}
          {displayMode === "real" && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded border border-terminal-amber/30 bg-terminal-amber/5 text-terminal-amber text-xs font-mono">
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              Showing inflation-adjusted (real) values — purchasing power in
              today's dollars
              {extConfig?.inflationRate !== undefined && (
                <span className="ml-auto font-bold">
                  @ {(extConfig.inflationRate * 100).toFixed(1)}% inflation
                </span>
              )}
            </div>
          )}

          {/* Sim metadata bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="text-terminal-green-dim">ID</span>
              <span className="text-foreground">
                #{String(displayResult.id)}
              </span>
            </span>
            <span className="opacity-30">·</span>
            <span>
              {Number(displayResult.config.numSimulations).toLocaleString()}{" "}
              paths
            </span>
            <span className="opacity-30">·</span>
            <span>
              {Number(displayResult.config.timeHorizonYears)} year horizon
            </span>
            {extConfig?.inflationRate !== undefined && (
              <>
                <span className="opacity-30">·</span>
                <span className="text-terminal-amber">
                  {(extConfig.inflationRate * 100).toFixed(1)}% inflation
                </span>
              </>
            )}
            {extConfig?.taxDrag !== undefined && extConfig.taxDrag > 0 && (
              <>
                <span className="opacity-30">·</span>
                <span className="text-terminal-amber">
                  {(extConfig.taxDrag * 100).toFixed(1)}% tax drag
                </span>
              </>
            )}
            {extConfig?.crashYear !== undefined && (
              <>
                <span className="opacity-30">·</span>
                <span className="text-terminal-red">
                  Crash Yr {String(extConfig.crashYear)} / -
                  {((extConfig.crashDrawdown ?? 0) * 100).toFixed(0)}%
                </span>
              </>
            )}
            <span className="opacity-30">·</span>
            <span className="text-muted-foreground/60">
              {formatTimestamp(displayResult.timestamp)}
            </span>
          </div>

          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              label="Initial Value"
              value={formatCurrency(displayResult.totalInitialValue, true)}
              sub="portfolio start"
              accent="default"
            />
            <StatCard
              label={
                displayMode === "real" ? "P50 Median (Real)" : "P50 Median"
              }
              value={formatCurrency(finalP50, true)}
              sub={`${profitLossPercent >= 0 ? "+" : ""}${profitLossPercent.toFixed(0)}% vs initial`}
              accent={profitLossPercent >= 0 ? "green" : "red"}
              icon={
                profitLossPercent >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )
              }
            />
            <StatCard
              label={
                displayMode === "real"
                  ? "P10 Pessimistic (Real)"
                  : "P10 Pessimistic"
              }
              value={formatCurrency(finalP10, true)}
              sub="worst 10% outcomes"
              accent="red"
            />
            <StatCard
              label={
                displayMode === "real"
                  ? "P90 Optimistic (Real)"
                  : "P90 Optimistic"
              }
              value={formatCurrency(finalP90, true)}
              sub="best 10% outcomes"
              accent="green"
            />
            <StatCard
              label={
                hasTarget
                  ? "Goal Probability"
                  : displayMode === "real"
                    ? "P75 Outcome (Real)"
                    : "P75 Outcome"
              }
              value={
                hasTarget
                  ? formatPercent(displayResult.probabilityOfGoal)
                  : formatCurrency(finalP75, true)
              }
              sub={
                hasTarget
                  ? `of ${formatCurrency(displayResult.config.targetValue!, true)}`
                  : "75th percentile"
              }
              accent={
                hasTarget
                  ? displayResult.probabilityOfGoal >= 0.7
                    ? "green"
                    : displayResult.probabilityOfGoal >= 0.4
                      ? "amber"
                      : "red"
                  : "cyan"
              }
              icon={hasTarget ? <Target className="w-3.5 h-3.5" /> : undefined}
            />
          </div>

          {/* ── Chart ── */}
          <div className="rounded border border-border bg-card p-5 shadow-terminal-card">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-terminal-green" />
                  Monte Carlo Tranche Bands
                </h2>
                {displayMode === "real" && (
                  <span className="text-[10px] font-mono text-terminal-amber border border-terminal-amber/30 bg-terminal-amber/10 px-1.5 py-0.5 rounded">
                    REAL
                  </span>
                )}
              </div>
              {/* Tranche legend */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
                {TRANCHES.map((t) => (
                  <span key={t.key} className="flex items-center gap-1.5">
                    {t.key === "T3" ? (
                      <span
                        className="w-4 h-[3px] rounded inline-block"
                        style={{ background: t.color }}
                      />
                    ) : (
                      <span
                        className="w-3 h-3 rounded-sm inline-block"
                        style={{ background: t.color, opacity: 0.75 }}
                      />
                    )}
                    <span className="text-muted-foreground/70">{t.label}</span>
                  </span>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={360}>
              <AreaChart
                data={chartData}
                stackOffset="none"
                margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="gradT1" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="oklch(0.42 0.10 145)"
                      stopOpacity={0.55}
                    />
                    <stop
                      offset="100%"
                      stopColor="oklch(0.42 0.10 145)"
                      stopOpacity={0.35}
                    />
                  </linearGradient>
                  <linearGradient id="gradT2" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="oklch(0.58 0.15 145)"
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="100%"
                      stopColor="oklch(0.58 0.15 145)"
                      stopOpacity={0.38}
                    />
                  </linearGradient>
                  <linearGradient id="gradT4" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="oklch(0.74 0.19 145)"
                      stopOpacity={0.65}
                    />
                    <stop
                      offset="100%"
                      stopColor="oklch(0.74 0.19 145)"
                      stopOpacity={0.4}
                    />
                  </linearGradient>
                  <linearGradient id="gradT5" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="oklch(0.82 0.21 145)"
                      stopOpacity={0.7}
                    />
                    <stop
                      offset="100%"
                      stopColor="oklch(0.82 0.21 145)"
                      stopOpacity={0.42}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.22 0.025 155)"
                  opacity={0.4}
                />

                <XAxis
                  dataKey="year"
                  tick={{
                    fontSize: 10,
                    fontFamily: "Geist Mono, monospace",
                    fill: "oklch(0.50 0.05 145)",
                  }}
                  tickLine={false}
                  axisLine={{ stroke: "oklch(0.22 0.025 155)" }}
                  label={{
                    value: "Year",
                    position: "insideBottom",
                    offset: -2,
                    fontSize: 10,
                    fill: "oklch(0.40 0.05 145)",
                    fontFamily: "Geist Mono, monospace",
                  }}
                />

                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{
                    fontSize: 10,
                    fontFamily: "Geist Mono, monospace",
                    fill: "oklch(0.50 0.05 145)",
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />

                <Tooltip content={<ChartTooltip />} />

                <Area
                  type="monotone"
                  dataKey="base"
                  stackId="tranche"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                  legendType="none"
                  name="floor"
                />
                <Area
                  type="monotone"
                  dataKey="band1"
                  stackId="tranche"
                  stroke="oklch(0.42 0.10 145)"
                  strokeWidth={0.5}
                  strokeOpacity={0.6}
                  fill="url(#gradT1)"
                  isAnimationActive={true}
                  animationDuration={600}
                  animationBegin={0}
                  name="Bear Case (P10–P25)"
                />
                <Area
                  type="monotone"
                  dataKey="band2"
                  stackId="tranche"
                  stroke="oklch(0.58 0.15 145)"
                  strokeWidth={0.5}
                  strokeOpacity={0.7}
                  fill="url(#gradT2)"
                  isAnimationActive={true}
                  animationDuration={700}
                  animationBegin={100}
                  name="Below Median (P25–P50)"
                />
                <Area
                  type="monotone"
                  dataKey="band3"
                  stackId="tranche"
                  stroke="oklch(0.74 0.19 145)"
                  strokeWidth={0.5}
                  strokeOpacity={0.7}
                  fill="url(#gradT4)"
                  isAnimationActive={true}
                  animationDuration={800}
                  animationBegin={200}
                  name="Above Median (P50–P75)"
                />
                <Area
                  type="monotone"
                  dataKey="band4"
                  stackId="tranche"
                  stroke="oklch(0.82 0.21 145)"
                  strokeWidth={0.5}
                  strokeOpacity={0.8}
                  fill="url(#gradT5)"
                  isAnimationActive={true}
                  animationDuration={900}
                  animationBegin={300}
                  name="Bull Case (P75–P90)"
                />
                <Area
                  type="monotone"
                  dataKey="p50"
                  stroke="oklch(0.78 0.19 145)"
                  strokeWidth={2.5}
                  fill="none"
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationBegin={0}
                  name="Median (P50)"
                />

                <ReferenceLine
                  y={displayResult.totalInitialValue}
                  stroke="oklch(0.50 0.05 145)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{
                    value: "Initial",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "oklch(0.50 0.05 145)",
                    fontFamily: "Geist Mono, monospace",
                  }}
                />

                {hasTarget && displayResult.config.targetValue && (
                  <ReferenceLine
                    y={displayResult.config.targetValue}
                    stroke="oklch(0.78 0.18 80)"
                    strokeDasharray="6 3"
                    strokeOpacity={0.7}
                    label={{
                      value: "Target",
                      position: "insideTopRight",
                      fontSize: 9,
                      fill: "oklch(0.78 0.18 80)",
                      fontFamily: "Geist Mono, monospace",
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Percentile breakdown table ── */}
          <div className="rounded border border-border bg-card shadow-terminal-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-background/50 flex items-center justify-between">
              <h2 className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
                Final Year Percentile Distribution
              </h2>
              {hasRealData && (
                <span className="text-[10px] font-mono text-muted-foreground/50">
                  Showing Nominal + Real side by side
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-5 py-2 text-left text-[10px] tracking-widest text-muted-foreground uppercase">
                      Percentile
                    </th>
                    <th className="px-5 py-2 text-left text-[10px] tracking-widest text-muted-foreground uppercase">
                      Nominal Value
                    </th>
                    <th className="px-5 py-2 text-left text-[10px] tracking-widest text-muted-foreground uppercase">
                      vs Initial
                    </th>
                    {hasRealData && (
                      <th className="px-5 py-2 text-left text-[10px] tracking-widest text-terminal-amber/70 uppercase">
                        Real Value
                      </th>
                    )}
                    {hasRealData && (
                      <th className="px-5 py-2 text-left text-[10px] tracking-widest text-terminal-amber/70 uppercase">
                        Real vs Initial
                      </th>
                    )}
                    <th className="px-5 py-2 text-left text-[10px] tracking-widest text-muted-foreground uppercase">
                      Growth (CAGR)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      pct: "P10",
                      label: "Pessimistic",
                      nomVal: displayResult.finalP10,
                      realVal: extResult?.finalP10Real,
                      color: "text-terminal-red",
                    },
                    {
                      pct: "P25",
                      label: "Below Median",
                      nomVal: displayResult.finalP25,
                      realVal: extResult?.finalP25Real,
                      color: "text-terminal-amber",
                    },
                    {
                      pct: "P50",
                      label: "Median",
                      nomVal: displayResult.finalP50,
                      realVal: extResult?.finalP50Real,
                      color: "text-foreground",
                      bold: true,
                    },
                    {
                      pct: "P75",
                      label: "Above Median",
                      nomVal: displayResult.finalP75,
                      realVal: extResult?.finalP75Real,
                      color: "text-terminal-cyan",
                    },
                    {
                      pct: "P90",
                      label: "Optimistic",
                      nomVal: displayResult.finalP90,
                      realVal: extResult?.finalP90Real,
                      color: "text-terminal-green",
                    },
                  ].map(({ pct, label, nomVal, realVal, color, bold }) => {
                    const diff = nomVal - displayResult.totalInitialValue;
                    const pctGrowth =
                      (diff / displayResult.totalInitialValue) * 100;
                    const realDiff =
                      realVal !== undefined
                        ? realVal - displayResult.totalInitialValue
                        : null;
                    const realPctGrowth =
                      realDiff !== null
                        ? (realDiff / displayResult.totalInitialValue) * 100
                        : null;
                    const cagr =
                      (nomVal / displayResult.totalInitialValue) **
                        (1 / Number(displayResult.config.timeHorizonYears)) -
                      1;
                    return (
                      <tr
                        key={pct}
                        className="border-b border-border/30 last:border-0 hover:bg-accent/10 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <span className={cn("font-bold text-xs", color)}>
                            {pct}
                          </span>
                          <span className="text-muted-foreground/50 text-xs ml-2">
                            {label}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3 data-value",
                            bold ? "font-bold" : "",
                            color,
                          )}
                        >
                          {formatCurrency(nomVal)}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3 data-value text-xs",
                            diff >= 0
                              ? "text-terminal-green"
                              : "text-terminal-red",
                          )}
                        >
                          {diff >= 0 ? "+" : ""}
                          {pctGrowth.toFixed(0)}%
                        </td>
                        {hasRealData && (
                          <td
                            className={cn(
                              "px-5 py-3 data-value text-xs text-terminal-amber",
                            )}
                          >
                            {realVal !== undefined
                              ? formatCurrency(realVal)
                              : "—"}
                          </td>
                        )}
                        {hasRealData && (
                          <td
                            className={cn(
                              "px-5 py-3 data-value text-xs",
                              realDiff !== null && realDiff >= 0
                                ? "text-terminal-amber"
                                : "text-terminal-red",
                            )}
                          >
                            {realPctGrowth !== null
                              ? `${realPctGrowth >= 0 ? "+" : ""}${realPctGrowth.toFixed(0)}%`
                              : "—"}
                          </td>
                        )}
                        <td className="px-5 py-3 text-xs text-muted-foreground data-value">
                          {(cagr * 100).toFixed(1)}% CAGR
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Config summary */}
          <div className="rounded border border-border/50 bg-background/30 px-5 py-4">
            <h3 className="text-[10px] font-mono tracking-widest text-muted-foreground/50 uppercase mb-2">
              Simulation Configuration
            </h3>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono text-muted-foreground/60">
              <span>
                Paths:{" "}
                <span className="text-foreground/70">
                  {Number(displayResult.config.numSimulations).toLocaleString()}
                </span>
              </span>
              <span>
                Horizon:{" "}
                <span className="text-foreground/70">
                  {Number(displayResult.config.timeHorizonYears)} yr
                </span>
              </span>
              <span>
                Initial Value:{" "}
                <span className="text-foreground/70">
                  {formatCurrency(displayResult.totalInitialValue)}
                </span>
              </span>
              {hasTarget && (
                <span>
                  Target:{" "}
                  <span className="text-terminal-amber">
                    {formatCurrency(displayResult.config.targetValue!)}
                  </span>
                </span>
              )}
              {extConfig?.inflationRate !== undefined && (
                <span>
                  Inflation:{" "}
                  <span className="text-terminal-amber">
                    {(extConfig.inflationRate * 100).toFixed(1)}%/yr
                  </span>
                </span>
              )}
              {extConfig?.taxDrag !== undefined && extConfig.taxDrag > 0 && (
                <span>
                  Tax Drag:{" "}
                  <span className="text-terminal-amber">
                    {(extConfig.taxDrag * 100).toFixed(1)}%
                  </span>
                </span>
              )}
              {extConfig?.crashYear !== undefined && (
                <span>
                  Crash:{" "}
                  <span className="text-terminal-red">
                    Yr {String(extConfig.crashYear)} / -
                    {((extConfig.crashDrawdown ?? 0) * 100).toFixed(0)}%
                  </span>
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Clear dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent className="bg-card border-border font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-terminal-red">
              <AlertTriangle className="w-4 h-4" />
              Clear All History?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete all {history?.length ?? 0} simulation
              records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border font-mono">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-terminal-red text-destructive-foreground hover:bg-terminal-red/80 font-mono"
            >
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "green" | "red" | "cyan" | "amber" | "default";
  icon?: React.ReactNode;
}) {
  const accentMap = {
    green: "text-terminal-green border-terminal-green/20",
    red: "text-terminal-red border-terminal-red/20",
    cyan: "text-terminal-cyan border-terminal-cyan/20",
    amber: "text-terminal-amber border-terminal-amber/20",
    default: "text-foreground border-border",
  };
  const [mainAccent] = accentMap[accent].split(" ");

  return (
    <div
      className={cn(
        "rounded border bg-card p-4 space-y-1.5",
        accentMap[accent],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase leading-tight">
          {label}
        </span>
        {icon && <span className={cn("opacity-60", mainAccent)}>{icon}</span>}
      </div>
      <p
        className={cn(
          "data-value text-lg font-mono font-bold leading-tight",
          mainAccent,
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] font-mono text-muted-foreground/50">{sub}</p>
      )}
    </div>
  );
}
