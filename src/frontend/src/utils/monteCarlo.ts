import type {
  Account,
  SimulationConfig,
  SimulationResult,
  YearStats,
} from "../backend.d";

// Asset-class base return/volatility table
const ASSET_PARAMS: Record<string, [number, number]> = {
  Equity: [0.1, 0.18],
  Bond: [0.04, 0.06],
  "Real Estate": [0.07, 0.12],
  Crypto: [0.2, 0.6],
  Commodities: [0.05, 0.15],
  Cash: [0.02, 0.01],
  Alternative: [0.08, 0.14],
  International: [0.09, 0.2],
};
const DEFAULT_PARAMS: [number, number] = [0.07, 0.15];

function assetParams(accountType: string, riskScore: number): [number, number] {
  const [baseReturn, baseVol] = ASSET_PARAMS[accountType] ?? DEFAULT_PARAMS;
  const riskFactor = (riskScore - 5) / 5; // -0.8 to +1.0
  const adjReturn = baseReturn + riskFactor * 0.04;
  const adjVol = Math.max(baseVol * (1 + riskFactor * 0.3), 0.01);
  return [adjReturn, adjVol];
}

function portfolioParams(accounts: Account[]): [number, number, number] {
  // returns [totalValue, weightedMeanReturn, weightedVol]
  const total = accounts.reduce((sum, a) => sum + a.amount, 0);
  if (total <= 0) return [0, 0.07, 0.15];
  let wMean = 0;
  let wVol = 0;
  for (const a of accounts) {
    const w = a.amount / total;
    const [mu, sigma] = assetParams(a.accountType, Number(a.riskScore));
    wMean += w * mu;
    wVol += w * sigma;
  }
  return [total, wMean, wVol];
}

function randNormal(): number {
  // Box-Muller transform
  const u1 = Math.random() + 1e-10;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
}

export function runMonteCarloSimulation(
  accounts: Account[],
  config: SimulationConfig,
  backendId: bigint,
  backendTimestamp: bigint,
): SimulationResult {
  const N = Math.min(Number(config.numSimulations), 50000);
  const T = Math.min(Math.max(Number(config.timeHorizonYears), 1), 50);
  const contrib = Math.max(config.annualContribution, 0);

  const [totalInitial, mu, sigma] = portfolioParams(accounts);
  const startValue = totalInitial > 0 ? totalInitial : 10000;

  // Initialize paths
  const pathValues = new Float64Array(N).fill(startValue);
  const drift = mu - 0.5 * sigma * sigma;

  const yearlyStats: YearStats[] = [];

  for (let yr = 1; yr <= T; yr++) {
    // Advance each path one year using GBM
    for (let i = 0; i < N; i++) {
      const z = randNormal();
      pathValues[i] = pathValues[i] * Math.exp(drift + sigma * z) + contrib;
    }

    // Sort copy for percentiles
    const sorted = Array.from(pathValues).sort((a, b) => a - b);
    const mean = pathValues.reduce((s, v) => s + v, 0) / N;

    yearlyStats.push({
      year: BigInt(yr),
      p10: percentile(sorted, 0.1),
      p25: percentile(sorted, 0.25),
      p50: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p90: percentile(sorted, 0.9),
      mean,
    });
  }

  const finalSorted = Array.from(pathValues).sort((a, b) => a - b);
  const finalP10 = percentile(finalSorted, 0.1);
  const finalP25 = percentile(finalSorted, 0.25);
  const finalP50 = percentile(finalSorted, 0.5);
  const finalP75 = percentile(finalSorted, 0.75);
  const finalP90 = percentile(finalSorted, 0.9);

  let probabilityOfGoal = 0;
  if (config.targetValue !== undefined && config.targetValue > 0) {
    const hits = Array.from(pathValues).filter(
      (v) => v >= (config.targetValue as number),
    ).length;
    probabilityOfGoal = hits / N;
  }

  return {
    id: backendId,
    timestamp: backendTimestamp,
    config,
    yearlyStats,
    finalP10,
    finalP25,
    finalP50,
    finalP75,
    finalP90,
    probabilityOfGoal,
    totalInitialValue: startValue,
  };
}
