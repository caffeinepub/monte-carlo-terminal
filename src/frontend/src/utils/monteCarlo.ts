import type {
  Account,
  SimulationConfig,
  SimulationResult,
  YearStats,
} from "../backend.d";

// ─── Extended types (not yet in backend.d.ts) ───

export interface AccountOverride {
  accountId: bigint;
  rorOverride?: number;
  annualContribution: number;
  contributionGrowthRate: number;
  expenseRatio: number; // annual % fee drag (e.g. 0.01 = 1%)
  withdrawalAmount: number; // annual dollar amount withdrawn
  withdrawalStartYear: number; // year withdrawals begin (1-indexed)
}

export interface ExtendedSimulationConfig extends SimulationConfig {
  accountOverrides: AccountOverride[];
  inflationRate: number;
  taxDrag: number;
  crashYear?: bigint;
  crashDrawdown: number;
}

export interface ExtendedSimulationResult extends SimulationResult {
  yearlyStatsReal: YearStats[];
  finalP10Real: number;
  finalP25Real: number;
  finalP50Real: number;
  finalP75Real: number;
  finalP90Real: number;
}

// ─── Asset-class base return/volatility table ───

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
  config: ExtendedSimulationConfig,
  backendId: bigint,
  backendTimestamp: bigint,
): ExtendedSimulationResult {
  const N = Math.min(Number(config.numSimulations), 50000);
  const T = Math.min(Math.max(Number(config.timeHorizonYears), 1), 50);

  const crashYear =
    config.crashYear !== undefined ? Number(config.crashYear) : null;
  const crashDrawdown = Math.max(0, Math.min(1, config.crashDrawdown));
  const inflationRate = Math.max(0, config.inflationRate);
  const taxDrag = Math.max(0, Math.min(1, config.taxDrag));

  // ── Build per-account parameters ──
  interface AccountSim {
    weight: number;
    mu: number;
    sigma: number;
    drift: number;
    baseContrib: number;
    growthRate: number;
    withdrawalAmount: number;
    withdrawalStartYear: number;
  }

  const totalInitial = accounts.reduce((s, a) => s + a.amount, 0);
  const startValue = totalInitial > 0 ? totalInitial : 10000;

  const accountSims: AccountSim[] = accounts.map((a) => {
    const override = config.accountOverrides.find((o) => o.accountId === a.id);
    const [defaultMu, defaultSigma] = assetParams(
      a.accountType,
      Number(a.riskScore),
    );
    // Use override ROR if provided, else use asset-class + risk-adjusted default
    const mu =
      override?.rorOverride !== undefined ? override.rorOverride : defaultMu;
    const sigma = defaultSigma;
    const expenseRatio = override?.expenseRatio ?? 0;
    const effectiveMu = mu - expenseRatio;
    const drift = effectiveMu - 0.5 * sigma * sigma;
    const baseContrib = override?.annualContribution ?? 0;
    const growthRate = override?.contributionGrowthRate ?? 0;
    const withdrawalAmount = override?.withdrawalAmount ?? 0;
    const withdrawalStartYear = override?.withdrawalStartYear ?? 1;
    const weight = startValue > 0 ? a.amount / startValue : 1 / accounts.length;
    return {
      weight,
      mu,
      sigma,
      drift,
      baseContrib,
      growthRate,
      withdrawalAmount,
      withdrawalStartYear,
    };
  });

  // Fall back to portfolio-level params if no accounts
  const hasFallback = accountSims.length === 0;
  const fallbackMu = 0.07;
  const fallbackSigma = 0.15;
  const fallbackDrift = fallbackMu - 0.5 * fallbackSigma * fallbackSigma;
  // Legacy annualContribution from config as global fallback when no per-account overrides set
  const globalContrib = config.annualContribution;

  // ── Initialize per-account path arrays ──
  // Each path tracks value as a Float64Array per account
  let pathValues: Float64Array;
  if (!hasFallback) {
    // Initialize each path's total value (split by weight)
    pathValues = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      pathValues[i] = startValue;
    }
  } else {
    pathValues = new Float64Array(N).fill(startValue);
  }

  // Per-account separate tracking for GBM
  // We'll track N paths × M accounts separately to properly handle per-account GBM
  const M = accountSims.length;
  let accountPaths: Float64Array[] | null = null;
  if (M > 0) {
    accountPaths = accountSims.map((sim) => {
      const arr = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        arr[i] = sim.weight * startValue;
      }
      return arr;
    });
  }

  const yearlyStats: YearStats[] = [];
  const yearlyStatsReal: YearStats[] = [];

  for (let yr = 1; yr <= T; yr++) {
    if (M > 0 && accountPaths) {
      // Per-account GBM step
      for (let j = 0; j < M; j++) {
        const sim = accountSims[j];
        const paths = accountPaths[j];
        // Contribution for this year (grows each year by growthRate)
        const contrib = sim.baseContrib * (1 + sim.growthRate) ** (yr - 1);

        for (let i = 0; i < N; i++) {
          const prevVal = paths[i];
          const z = randNormal();
          const newVal = prevVal * Math.exp(sim.drift + sim.sigma * z);

          // Tax drag on returns (applied to gain portion)
          const gain = newVal - prevVal;
          const afterTaxGain = gain > 0 ? gain * (1 - taxDrag) : gain;
          let adjustedVal = prevVal + afterTaxGain;

          // Market crash: apply before adding contributions
          if (crashYear !== null && yr === crashYear) {
            adjustedVal *= 1 - crashDrawdown;
          }

          // Add contribution, subtract withdrawal if year >= withdrawalStartYear
          const withdrawal =
            yr >= sim.withdrawalStartYear ? sim.withdrawalAmount : 0;
          paths[i] = Math.max(0, adjustedVal + contrib - withdrawal);
        }
      }

      // Sum account paths into total portfolio value
      for (let i = 0; i < N; i++) {
        let total = 0;
        for (let j = 0; j < M; j++) {
          total += (accountPaths as Float64Array[])[j][i];
        }
        pathValues[i] = total;
      }
    } else {
      // Fallback: single portfolio GBM with legacy global contribution
      for (let i = 0; i < N; i++) {
        const z = randNormal();
        const prevVal = pathValues[i];
        const newVal = prevVal * Math.exp(fallbackDrift + fallbackSigma * z);
        const gain = newVal - prevVal;
        const afterTaxGain = gain > 0 ? gain * (1 - taxDrag) : gain;
        let adjustedVal = prevVal + afterTaxGain;

        if (crashYear !== null && yr === crashYear) {
          adjustedVal *= 1 - crashDrawdown;
        }
        pathValues[i] = adjustedVal + globalContrib;
      }
    }

    // Compute nominal stats
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

    // Compute real (inflation-adjusted) stats
    const inflationFactor = (1 + inflationRate) ** yr;
    yearlyStatsReal.push({
      year: BigInt(yr),
      p10: percentile(sorted, 0.1) / inflationFactor,
      p25: percentile(sorted, 0.25) / inflationFactor,
      p50: percentile(sorted, 0.5) / inflationFactor,
      p75: percentile(sorted, 0.75) / inflationFactor,
      p90: percentile(sorted, 0.9) / inflationFactor,
      mean: mean / inflationFactor,
    });
  }

  const finalSorted = Array.from(pathValues).sort((a, b) => a - b);
  const finalP10 = percentile(finalSorted, 0.1);
  const finalP25 = percentile(finalSorted, 0.25);
  const finalP50 = percentile(finalSorted, 0.5);
  const finalP75 = percentile(finalSorted, 0.75);
  const finalP90 = percentile(finalSorted, 0.9);

  const finalInflationFactor = (1 + inflationRate) ** T;
  const finalP10Real = finalP10 / finalInflationFactor;
  const finalP25Real = finalP25 / finalInflationFactor;
  const finalP50Real = finalP50 / finalInflationFactor;
  const finalP75Real = finalP75 / finalInflationFactor;
  const finalP90Real = finalP90 / finalInflationFactor;

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
    yearlyStatsReal,
    finalP10,
    finalP25,
    finalP50,
    finalP75,
    finalP90,
    finalP10Real,
    finalP25Real,
    finalP50Real,
    finalP75Real,
    finalP90Real,
    probabilityOfGoal,
    totalInitialValue: startValue,
  };
}
