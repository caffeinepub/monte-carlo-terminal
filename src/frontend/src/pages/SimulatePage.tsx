import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteScenario,
  useGetAccounts,
  useGetScenarios,
  useRunSimulation,
  useSaveScenario,
} from "@/hooks/useQueries";

import { cn } from "@/lib/utils";
import {
  formatCurrency,
  getAccountTypeAbbr,
  getAccountTypeColor,
  getRiskLevel,
} from "@/utils/format";
import type {
  AccountOverride,
  ExtendedSimulationConfig,
  ExtendedSimulationResult,
} from "@/utils/monteCarlo";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Loader2,
  Play,
  Save,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

const SIM_OPTIONS = [
  { value: "1000", label: "1,000 — Quick" },
  { value: "5000", label: "5,000 — Standard" },
  { value: "10000", label: "10,000 — Detailed" },
  { value: "25000", label: "25,000 — Precise" },
  { value: "50000", label: "50,000 — Extensive" },
];

interface SimulatePageProps {
  clientId: string;
  onSimulationComplete: (result: ExtendedSimulationResult) => void;
}

// Per-account override local state shape
interface AccountOverrideState {
  rorOverride: string; // empty = use default
  annualContribution: string;
  contributionGrowthRate: string;
  expenseRatio: string;
  withdrawalAmount: string;
  withdrawalStartYear: string;
  expanded: boolean;
}

function defaultOverrideState(): AccountOverrideState {
  return {
    rorOverride: "",
    annualContribution: "0",
    contributionGrowthRate: "0",
    expenseRatio: "0",
    withdrawalAmount: "0",
    withdrawalStartYear: "1",
    expanded: false,
  };
}

export default function SimulatePage({
  clientId,
  onSimulationComplete,
}: SimulatePageProps) {
  const { data: accounts, isLoading: accountsLoading } =
    useGetAccounts(clientId);
  const { data: scenarios, isLoading: scenariosLoading } =
    useGetScenarios(clientId);
  const runSimulation = useRunSimulation(clientId);
  const saveScenario = useSaveScenario(clientId);
  const deleteScenario = useDeleteScenario(clientId);

  // ── Section 1: Engine Parameters ──
  const [numSimulations, setNumSimulations] = useState("10000");
  const [timeHorizon, setTimeHorizon] = useState(20);

  // ── Section 2: Per-Account Overrides ──
  // keyed by account id as string
  const [overrides, setOverrides] = useState<
    Record<string, AccountOverrideState>
  >({});

  const getOverride = (id: bigint): AccountOverrideState =>
    overrides[String(id)] ?? defaultOverrideState();

  const setOverrideField = <K extends keyof AccountOverrideState>(
    id: bigint,
    field: K,
    value: AccountOverrideState[K],
  ) => {
    setOverrides((prev) => ({
      ...prev,
      [String(id)]: { ...getOverride(id), ...prev[String(id)], [field]: value },
    }));
  };

  const toggleExpanded = (id: bigint) => {
    setOverrides((prev) => {
      const cur = prev[String(id)] ?? defaultOverrideState();
      return { ...prev, [String(id)]: { ...cur, expanded: !cur.expanded } };
    });
  };

  // ── Section 3: Macro Factors ──
  const [inflationRate, setInflationRate] = useState(3.0);
  const [taxDrag, setTaxDrag] = useState(0.0);
  const [crashEnabled, setCrashEnabled] = useState(false);
  const [crashYear, setCrashYear] = useState("5");
  const [crashDrawdown, setCrashDrawdown] = useState(30);

  // ── Section 4: Target & Scenarios ──
  const [targetValue, setTargetValue] = useState("");
  const [scenarioName, setScenarioName] = useState("");

  const hasAccounts = accounts && accounts.length > 0;
  const totalValue = accounts?.reduce((sum, a) => sum + a.amount, 0) ?? 0;

  // ── Build config from current state ──
  const buildConfig = (): ExtendedSimulationConfig => {
    const accountOverrides: AccountOverride[] = (accounts ?? []).map((a) => {
      const ov = getOverride(a.id);
      return {
        accountId: a.id,
        rorOverride:
          ov.rorOverride !== ""
            ? Number.parseFloat(ov.rorOverride) / 100
            : undefined,
        annualContribution: Number.parseFloat(ov.annualContribution) || 0,
        contributionGrowthRate:
          Number.parseFloat(ov.contributionGrowthRate) / 100 || 0,
        expenseRatio: Number.parseFloat(ov.expenseRatio) / 100 || 0,
        withdrawalAmount: Number.parseFloat(ov.withdrawalAmount) || 0,
        withdrawalStartYear: Math.max(
          1,
          Number.parseInt(ov.withdrawalStartYear) || 1,
        ),
      };
    });

    return {
      numSimulations: BigInt(numSimulations),
      timeHorizonYears: BigInt(timeHorizon),
      annualContribution: accountOverrides.reduce(
        (s, o) => s + o.annualContribution,
        0,
      ),
      ...(targetValue && Number.parseFloat(targetValue) > 0
        ? { targetValue: Number.parseFloat(targetValue) }
        : {}),
      accountOverrides,
      inflationRate: inflationRate / 100,
      taxDrag: taxDrag / 100,
      crashYear: crashEnabled && crashYear ? BigInt(crashYear) : undefined,
      crashDrawdown: crashEnabled ? crashDrawdown / 100 : 0,
    };
  };

  // ── Load scenario into form ──
  const loadScenario = (scenario: {
    config: ExtendedSimulationConfig;
    name: string;
  }) => {
    const c = scenario.config;
    setNumSimulations(String(c.numSimulations));
    setTimeHorizon(Number(c.timeHorizonYears));
    setInflationRate((c.inflationRate ?? 0.03) * 100);
    setTaxDrag((c.taxDrag ?? 0) * 100);
    if (c.crashYear !== undefined && c.crashYear !== null) {
      setCrashEnabled(true);
      setCrashYear(String(c.crashYear));
      setCrashDrawdown((c.crashDrawdown ?? 0.3) * 100);
    } else {
      setCrashEnabled(false);
    }
    setTargetValue(c.targetValue ? String(c.targetValue) : "");
    setScenarioName(scenario.name);

    // Load per-account overrides
    const newOverrides: Record<string, AccountOverrideState> = {};
    for (const ov of c.accountOverrides ?? []) {
      newOverrides[String(ov.accountId)] = {
        rorOverride:
          ov.rorOverride !== undefined ? String(ov.rorOverride * 100) : "",
        annualContribution: String(ov.annualContribution),
        contributionGrowthRate: String((ov.contributionGrowthRate ?? 0) * 100),
        expenseRatio: String((ov.expenseRatio ?? 0) * 100),
        withdrawalAmount: String(ov.withdrawalAmount ?? 0),
        withdrawalStartYear: String(ov.withdrawalStartYear ?? 1),
        expanded: true,
      };
    }
    setOverrides(newOverrides);
    toast.success(`Loaded scenario: ${scenario.name}`);
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      toast.error("Enter a scenario name first");
      return;
    }
    try {
      await saveScenario.mutateAsync({
        name: scenarioName.trim(),
        config: buildConfig(),
      });
      toast.success(`Scenario "${scenarioName}" saved`);
    } catch {
      toast.error("Failed to save scenario", {
        description:
          "Scenario saving requires backend support (may not be available yet).",
      });
    }
  };

  const handleDeleteScenario = async (id: bigint, name: string) => {
    try {
      await deleteScenario.mutateAsync(id);
      toast.success(`Scenario "${name}" deleted`);
    } catch {
      toast.error("Failed to delete scenario");
    }
  };

  const handleRunSimulation = async () => {
    if (!hasAccounts) {
      toast.error("No accounts configured", {
        description: "Add at least one account before running a simulation.",
      });
      return;
    }

    const config = buildConfig();

    try {
      const result = await runSimulation.mutateAsync(config);
      toast.success("Simulation complete!", {
        description: `Ran ${Number(config.numSimulations).toLocaleString()} paths over ${timeHorizon} years`,
      });
      onSimulationComplete(result);
    } catch {
      toast.error("Simulation failed", {
        description:
          "An error occurred running the simulation. Please try again.",
      });
    }
  };

  // Total annual contributions and withdrawals across all accounts
  const totalAnnualContribs = (accounts ?? []).reduce((sum, a) => {
    const ov = getOverride(a.id);
    return sum + (Number.parseFloat(ov.annualContribution) || 0);
  }, 0);

  const totalAnnualWithdrawals = (accounts ?? []).reduce((sum, a) => {
    const ov = getOverride(a.id);
    return sum + (Number.parseFloat(ov.withdrawalAmount) || 0);
  }, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-mono">
          <span className="text-terminal-green opacity-60">›</span>
          <span className="tracking-widest uppercase">Monte Carlo Engine</span>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
          Configure Simulation
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ── Left: Config panels ── */}
        <div className="space-y-5">
          {/* ═══ SECTION 1: Engine Parameters ═══ */}
          <div className="rounded border border-border bg-card p-5 space-y-5 shadow-terminal-card">
            <h2 className="text-xs font-mono tracking-widest text-terminal-green uppercase flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Engine Parameters
            </h2>

            {/* Number of simulations */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                Number of Simulations
              </Label>
              <Select value={numSimulations} onValueChange={setNumSimulations}>
                <SelectTrigger className="bg-background border-border text-foreground font-mono focus:ring-terminal-green focus:border-terminal-green">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border font-mono">
                  {SIM_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-foreground focus:bg-accent font-mono"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time horizon */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                  <Clock className="w-3 h-3 inline mr-1 opacity-70" />
                  Time Horizon
                </Label>
                <span className="text-terminal-green font-mono font-bold text-sm data-value">
                  {timeHorizon}{" "}
                  <span className="text-terminal-green-dim text-xs font-normal">
                    yr{timeHorizon !== 1 ? "s" : ""}
                  </span>
                </span>
              </div>
              <Slider
                value={[timeHorizon]}
                onValueChange={([v]) => setTimeHorizon(v)}
                min={1}
                max={30}
                step={1}
                className="[&>[data-slot=slider-track]]:bg-border [&>[data-slot=slider-range]]:bg-terminal-green [&>[data-slot=slider-thumb]]:border-terminal-green [&>[data-slot=slider-thumb]]:bg-background"
              />
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground/40">
                <span>1 yr</span>
                <span>5 yr</span>
                <span>10 yr</span>
                <span>15 yr</span>
                <span>20 yr</span>
                <span>25 yr</span>
                <span>30 yr</span>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 2: Per-Account Configuration ═══ */}
          <div className="rounded border border-border bg-card p-5 space-y-4 shadow-terminal-card">
            <h2 className="text-xs font-mono tracking-widest text-terminal-cyan uppercase flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Per-Account Configuration
              <span className="ml-auto text-[10px] text-muted-foreground/40 normal-case tracking-normal">
                override defaults per position
              </span>
            </h2>

            {accountsLoading && (
              <div className="space-y-2">
                {["sk-1", "sk-2", "sk-3"].map((k) => (
                  <Skeleton key={k} className="h-14 w-full bg-muted/50" />
                ))}
              </div>
            )}

            {!accountsLoading && (!accounts || accounts.length === 0) && (
              <div className="flex items-center gap-2 px-3 py-4 rounded border border-terminal-amber/20 bg-terminal-amber/5 text-terminal-amber text-xs font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                No accounts found — add accounts first
              </div>
            )}

            <div className="space-y-2">
              {accounts?.map((account) => {
                const risk = getRiskLevel(account.riskScore);
                const typeColor = getAccountTypeColor(account.accountType);
                const typeAbbr = getAccountTypeAbbr(account.accountType);
                const ov = getOverride(account.id);
                const isExpanded = ov.expanded;

                return (
                  <div
                    key={String(account.id)}
                    className={cn(
                      "rounded border transition-colors",
                      isExpanded
                        ? "border-terminal-cyan/30 bg-terminal-cyan/5"
                        : "border-border/50 bg-background/40",
                    )}
                  >
                    {/* Account header row */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(account.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors rounded"
                    >
                      <span
                        className={cn(
                          "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0",
                          typeColor,
                        )}
                      >
                        {typeAbbr}
                      </span>
                      <span className="flex-1 text-xs font-mono text-foreground truncate">
                        {account.name}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground/60 data-value shrink-0">
                        {formatCurrency(account.amount)}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded",
                          risk.bg,
                          risk.color,
                        )}
                      >
                        R{Number(account.riskScore)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-terminal-cyan shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                      )}
                    </button>

                    {/* Expanded override fields */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-border/30 pt-3 space-y-3">
                        {/* Row 1: Expected ROR, Annual Contribution, Contrib Growth Rate */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Expected ROR Override */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-mono">
                              Expected ROR
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={ov.rorOverride}
                                onChange={(e) =>
                                  setOverrideField(
                                    account.id,
                                    "rorOverride",
                                    e.target.value,
                                  )
                                }
                                placeholder="Asset default"
                                min="0"
                                max="100"
                                step="0.1"
                                className="pr-7 bg-background border-border text-foreground font-mono text-xs placeholder:text-muted-foreground/30 focus-visible:ring-terminal-cyan focus-visible:border-terminal-cyan h-8"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs font-mono">
                                %
                              </span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/40 font-mono">
                              Leave empty to use asset-class default
                            </p>
                          </div>

                          {/* Annual Contribution */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-mono">
                              Annual Contribution
                            </Label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs font-mono">
                                $
                              </span>
                              <Input
                                type="number"
                                value={ov.annualContribution}
                                onChange={(e) =>
                                  setOverrideField(
                                    account.id,
                                    "annualContribution",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                min="0"
                                className="pl-6 bg-background border-border text-foreground font-mono text-xs placeholder:text-muted-foreground/30 focus-visible:ring-terminal-cyan focus-visible:border-terminal-cyan h-8"
                              />
                            </div>
                            <p className="text-[9px] text-muted-foreground/40 font-mono">
                              Added to this account each year
                            </p>
                          </div>

                          {/* Contribution Growth Rate */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-mono">
                              Contrib. Growth Rate
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={ov.contributionGrowthRate}
                                onChange={(e) =>
                                  setOverrideField(
                                    account.id,
                                    "contributionGrowthRate",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                min="0"
                                max="100"
                                step="0.1"
                                className="pr-7 bg-background border-border text-foreground font-mono text-xs placeholder:text-muted-foreground/30 focus-visible:ring-terminal-cyan focus-visible:border-terminal-cyan h-8"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs font-mono">
                                %
                              </span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/40 font-mono">
                              Annual increase in contribution
                            </p>
                          </div>
                        </div>

                        {/* Row 2: Expense Ratio, Annual Withdrawal, Withdrawal Start Year */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/20">
                          {/* Expense Ratio */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-mono">
                              Expense Ratio
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={ov.expenseRatio}
                                onChange={(e) =>
                                  setOverrideField(
                                    account.id,
                                    "expenseRatio",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                min="0"
                                max="10"
                                step="0.01"
                                className="pr-7 bg-background border-border text-foreground font-mono text-xs placeholder:text-muted-foreground/30 focus-visible:ring-terminal-amber focus-visible:border-terminal-amber h-8"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs font-mono">
                                %
                              </span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/40 font-mono">
                              Annual mgmt / fund fee drag
                            </p>
                          </div>

                          {/* Annual Withdrawal */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-mono">
                              Annual Withdrawal
                            </Label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs font-mono">
                                $
                              </span>
                              <Input
                                type="number"
                                value={ov.withdrawalAmount}
                                onChange={(e) =>
                                  setOverrideField(
                                    account.id,
                                    "withdrawalAmount",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                min="0"
                                className="pl-6 bg-background border-border text-foreground font-mono text-xs placeholder:text-muted-foreground/30 focus-visible:ring-terminal-amber focus-visible:border-terminal-amber h-8"
                              />
                            </div>
                            <p className="text-[9px] text-muted-foreground/40 font-mono">
                              Annual amount withdrawn from account
                            </p>
                          </div>

                          {/* Withdrawal Start Year */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-mono">
                              Withdrawal Start Yr
                            </Label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={ov.withdrawalStartYear}
                                onChange={(e) =>
                                  setOverrideField(
                                    account.id,
                                    "withdrawalStartYear",
                                    e.target.value,
                                  )
                                }
                                placeholder="1"
                                min="1"
                                max={timeHorizon}
                                className="pr-7 bg-background border-border text-foreground font-mono text-xs placeholder:text-muted-foreground/30 focus-visible:ring-terminal-amber focus-visible:border-terminal-amber h-8"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs font-mono">
                                yr
                              </span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/40 font-mono">
                              Year withdrawals begin
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ SECTION 3: Macro Factors ═══ */}
          <div className="rounded border border-border bg-card p-5 space-y-5 shadow-terminal-card">
            <h2 className="text-xs font-mono tracking-widest text-terminal-amber uppercase flex items-center gap-2">
              <TrendingDown className="w-3.5 h-3.5" />
              Macro Factors
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Inflation Rate */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                    Inflation Rate
                  </Label>
                  <span className="text-terminal-amber font-mono font-bold text-sm data-value">
                    {inflationRate.toFixed(1)}
                    <span className="text-terminal-amber/60 text-xs font-normal ml-0.5">
                      %/yr
                    </span>
                  </span>
                </div>
                <Slider
                  value={[inflationRate]}
                  onValueChange={([v]) => setInflationRate(v)}
                  min={0}
                  max={15}
                  step={0.1}
                  className="[&>[data-slot=slider-track]]:bg-border [&>[data-slot=slider-range]]:bg-terminal-amber [&>[data-slot=slider-thumb]]:border-terminal-amber [&>[data-slot=slider-thumb]]:bg-background"
                />
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground/40">
                  <span>0%</span>
                  <span>5%</span>
                  <span>10%</span>
                  <span>15%</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 font-mono">
                  Results shown in both nominal and real (inflation-adjusted)
                  terms
                </p>
              </div>

              {/* Tax Drag */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                    Tax Drag
                  </Label>
                  <span className="text-terminal-amber font-mono font-bold text-sm data-value">
                    {taxDrag.toFixed(1)}
                    <span className="text-terminal-amber/60 text-xs font-normal ml-0.5">
                      %/yr
                    </span>
                  </span>
                </div>
                <Slider
                  value={[taxDrag]}
                  onValueChange={([v]) => setTaxDrag(v)}
                  min={0}
                  max={40}
                  step={0.5}
                  className="[&>[data-slot=slider-track]]:bg-border [&>[data-slot=slider-range]]:bg-terminal-amber [&>[data-slot=slider-thumb]]:border-terminal-amber [&>[data-slot=slider-thumb]]:bg-background"
                />
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground/40">
                  <span>0%</span>
                  <span>10%</span>
                  <span>20%</span>
                  <span>30%</span>
                  <span>40%</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 font-mono">
                  Annual % of gains lost to taxes (capital gains, dividends,
                  etc.)
                </p>
              </div>
            </div>

            {/* Market Crash Scenario */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={crashEnabled}
                    onCheckedChange={setCrashEnabled}
                    className="data-[state=checked]:bg-terminal-red"
                  />
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono cursor-pointer">
                    Market Crash Scenario
                  </Label>
                </div>
                {crashEnabled && (
                  <span className="text-terminal-red text-[10px] font-mono font-bold animate-pulse">
                    ⚠ ACTIVE
                  </span>
                )}
              </div>

              {crashEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l border-terminal-red/20 ml-2">
                  {/* Crash Year */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-mono">
                      Crash Year
                    </Label>
                    <Input
                      type="number"
                      value={crashYear}
                      onChange={(e) => setCrashYear(e.target.value)}
                      placeholder={`1–${timeHorizon}`}
                      min="1"
                      max={timeHorizon}
                      className="bg-background border-terminal-red/30 text-foreground font-mono text-xs focus-visible:ring-terminal-red focus-visible:border-terminal-red h-8"
                    />
                    <p className="text-[9px] text-muted-foreground/40 font-mono">
                      Year in simulation when crash occurs
                    </p>
                  </div>

                  {/* Drawdown % */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-mono">
                        Drawdown
                      </Label>
                      <span className="text-terminal-red font-mono font-bold text-sm data-value">
                        -{crashDrawdown}
                        <span className="text-terminal-red/60 text-xs font-normal ml-0.5">
                          %
                        </span>
                      </span>
                    </div>
                    <Slider
                      value={[crashDrawdown]}
                      onValueChange={([v]) => setCrashDrawdown(v)}
                      min={5}
                      max={80}
                      step={1}
                      className="[&>[data-slot=slider-track]]:bg-border [&>[data-slot=slider-range]]:bg-terminal-red [&>[data-slot=slider-thumb]]:border-terminal-red [&>[data-slot=slider-thumb]]:bg-background"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-muted-foreground/40">
                      <span>-5%</span>
                      <span>-40%</span>
                      <span>-80%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ SECTION 4: Target & Scenarios ═══ */}
          <div className="rounded border border-border bg-card p-5 space-y-5 shadow-terminal-card">
            <h2 className="text-xs font-mono tracking-widest text-terminal-green-dim uppercase flex items-center gap-2">
              <Target className="w-3.5 h-3.5" />
              Target & Scenarios
            </h2>

            {/* Target Portfolio Value */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                Target Portfolio Value
                <span className="text-[10px] ml-1 text-muted-foreground/40 normal-case tracking-normal">
                  (optional)
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">
                  $
                </span>
                <Input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g., 1000000"
                  min="0"
                  className="pl-7 bg-background border-border text-foreground font-mono placeholder:text-muted-foreground/40 focus-visible:ring-terminal-cyan focus-visible:border-terminal-cyan"
                />
              </div>
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                Enables probability-of-goal calculation in results
              </p>
            </div>

            {/* Save Scenario */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Save className="w-3 h-3" />
                Save as Scenario
              </Label>
              <div className="flex gap-2">
                <Input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g., Conservative Plan, Bull Case 2030"
                  className="flex-1 bg-background border-border text-foreground font-mono text-sm placeholder:text-muted-foreground/30 focus-visible:ring-terminal-green focus-visible:border-terminal-green"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveScenario();
                  }}
                />
                <Button
                  variant="outline"
                  onClick={handleSaveScenario}
                  disabled={saveScenario.isPending || !scenarioName.trim()}
                  className="border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 font-mono text-xs shrink-0"
                >
                  {saveScenario.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1.5">Save</span>
                </Button>
              </div>
            </div>

            {/* Saved Scenarios List */}
            {!scenariosLoading && scenarios && scenarios.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" />
                  Saved Scenarios ({scenarios.length})
                </Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {scenarios.map((scenario) => (
                    <div
                      key={String(scenario.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded border border-border/40 bg-background/40 hover:border-terminal-green/30 hover:bg-terminal-green/5 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-foreground font-medium truncate">
                          {scenario.name}
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">
                          {Number(
                            scenario.config.numSimulations,
                          ).toLocaleString()}{" "}
                          paths · {Number(scenario.config.timeHorizonYears)} yr
                          ·{" "}
                          {((scenario.config.inflationRate ?? 0) * 100).toFixed(
                            1,
                          )}
                          % inflation
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => loadScenario(scenario)}
                          className="h-7 px-2 text-[10px] font-mono text-terminal-green hover:bg-terminal-green/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleDeleteScenario(scenario.id, scenario.name)
                          }
                          disabled={deleteScenario.isPending}
                          className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-terminal-red hover:bg-terminal-red/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Run button ── */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              onClick={handleRunSimulation}
              disabled={runSimulation.isPending || !hasAccounts}
              className={cn(
                "w-full h-14 text-base font-mono font-bold shadow-terminal-glow transition-all",
                "bg-terminal-green text-primary-foreground",
                "hover:bg-terminal-green-glow hover:shadow-[0_0_30px_oklch(var(--terminal-green)/0.35)]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {runSimulation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Running {Number(numSimulations).toLocaleString()} simulations…
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-3" />
                  Run Simulation
                  <ChevronRight className="w-4 h-4 ml-2 opacity-60" />
                </>
              )}
            </Button>
          </motion.div>

          {!hasAccounts && !accountsLoading && (
            <div className="flex items-center gap-2 px-4 py-3 rounded border border-terminal-amber/30 bg-terminal-amber/5 text-terminal-amber text-xs font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              No accounts configured — add accounts on the Accounts page first
            </div>
          )}
        </div>

        {/* ── Right: Portfolio preview + Sim Preview ── */}
        <div className="space-y-4">
          {/* Portfolio Snapshot */}
          <div className="rounded border border-border bg-card p-4 shadow-terminal-card">
            <h2 className="text-xs font-mono tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-2">
              Portfolio Snapshot
              <span className="ml-auto text-terminal-green text-[10px]">
                {accounts?.length ?? 0} positions
              </span>
            </h2>

            {accountsLoading && (
              <div className="space-y-2">
                {["sk-1", "sk-2", "sk-3"].map((k) => (
                  <Skeleton key={k} className="h-10 w-full bg-muted/50" />
                ))}
              </div>
            )}

            {!accountsLoading && (!accounts || accounts.length === 0) && (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-xs font-mono">
                  NO ACCOUNTS
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              {accounts?.map((account) => {
                const risk = getRiskLevel(account.riskScore);
                const typeColor = getAccountTypeColor(account.accountType);
                const typeAbbr = getAccountTypeAbbr(account.accountType);
                const ov = getOverride(account.id);
                const contrib = Number.parseFloat(ov.annualContribution) || 0;
                const withdrawal = Number.parseFloat(ov.withdrawalAmount) || 0;
                return (
                  <div
                    key={String(account.id)}
                    className="flex items-center gap-2 py-1.5 px-2 rounded bg-background/50 border border-border/30"
                  >
                    <span
                      className={cn(
                        "text-[9px] font-mono font-bold px-1 py-0.5 rounded border shrink-0",
                        typeColor,
                      )}
                    >
                      {typeAbbr}
                    </span>
                    <span className="flex-1 text-xs font-mono text-foreground truncate">
                      {account.name}
                    </span>
                    {contrib > 0 && (
                      <span className="text-[9px] font-mono text-terminal-cyan shrink-0">
                        +{formatCurrency(contrib)}/yr
                      </span>
                    )}
                    {withdrawal > 0 && (
                      <span className="text-[9px] font-mono text-terminal-amber shrink-0">
                        -{formatCurrency(withdrawal)}/yr
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[9px] font-mono font-bold shrink-0",
                        risk.color,
                      )}
                    >
                      R{Number(account.riskScore)}
                    </span>
                  </div>
                );
              })}
            </div>

            {hasAccounts && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Initial Value</span>
                  <span className="text-terminal-green font-bold data-value">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
                {totalAnnualContribs > 0 && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Annual Add</span>
                    <span className="text-terminal-cyan data-value">
                      +{formatCurrency(totalAnnualContribs)}/yr
                    </span>
                  </div>
                )}
                {totalAnnualWithdrawals > 0 && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Annual Draw</span>
                    <span className="text-terminal-amber data-value">
                      -{formatCurrency(totalAnnualWithdrawals)}/yr
                    </span>
                  </div>
                )}
                {totalAnnualContribs > 0 && totalAnnualWithdrawals > 0 && (
                  <div className="flex justify-between text-xs font-mono border-t border-border/30 pt-1">
                    <span className="text-muted-foreground">Net Flow</span>
                    <span
                      className={cn(
                        "data-value font-bold",
                        totalAnnualContribs - totalAnnualWithdrawals >= 0
                          ? "text-terminal-green"
                          : "text-terminal-red",
                      )}
                    >
                      {totalAnnualContribs - totalAnnualWithdrawals >= 0
                        ? "+"
                        : ""}
                      {formatCurrency(
                        totalAnnualContribs - totalAnnualWithdrawals,
                      )}
                      /yr
                    </span>
                  </div>
                )}
                {targetValue && Number.parseFloat(targetValue) > 0 && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Target</span>
                    <span className="text-terminal-amber data-value">
                      {formatCurrency(Number.parseFloat(targetValue))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Simulation Preview Card */}
          <div className="rounded border border-terminal-green/20 bg-terminal-green/5 p-4">
            <h3 className="text-[10px] font-mono tracking-widest text-terminal-green-dim uppercase mb-3">
              Simulation Preview
            </h3>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">Paths</span>
                <span className="text-foreground data-value">
                  {Number(numSimulations).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">Horizon</span>
                <span className="text-foreground">{timeHorizon} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">Data Points</span>
                <span className="text-terminal-green data-value">
                  {(Number(numSimulations) * timeHorizon).toLocaleString()}
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-border/30 my-1" />

              <div className="flex justify-between">
                <span className="text-muted-foreground/60">Inflation</span>
                <span
                  className={cn(
                    "data-value",
                    inflationRate > 0
                      ? "text-terminal-amber"
                      : "text-muted-foreground/40",
                  )}
                >
                  {inflationRate.toFixed(1)}%/yr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">Tax Drag</span>
                <span
                  className={cn(
                    "data-value",
                    taxDrag > 0
                      ? "text-terminal-amber"
                      : "text-muted-foreground/40",
                  )}
                >
                  {taxDrag.toFixed(1)}%
                </span>
              </div>
              {crashEnabled && (
                <div className="flex justify-between">
                  <span className="text-terminal-red/70">Crash Yr</span>
                  <span className="text-terminal-red data-value font-bold">
                    Yr {crashYear} / -{crashDrawdown}%
                  </span>
                </div>
              )}
              {totalAnnualContribs > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60">Annual Add</span>
                  <span className="text-terminal-cyan data-value">
                    +{formatCurrency(totalAnnualContribs)}
                  </span>
                </div>
              )}
              {totalAnnualWithdrawals > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60">Annual Draw</span>
                  <span className="text-terminal-amber data-value">
                    -{formatCurrency(totalAnnualWithdrawals)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
