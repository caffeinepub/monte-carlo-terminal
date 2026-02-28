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
import { useGetAccounts, useRunSimulation } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  getAccountTypeAbbr,
  getAccountTypeColor,
  getRiskLevel,
} from "@/utils/format";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  Play,
  Target,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { SimulationResult } from "../backend.d";

const SIM_OPTIONS = [
  { value: "1000", label: "1,000 — Quick" },
  { value: "5000", label: "5,000 — Standard" },
  { value: "10000", label: "10,000 — Detailed" },
  { value: "25000", label: "25,000 — Precise" },
  { value: "50000", label: "50,000 — Extensive" },
];

interface SimulatePageProps {
  onSimulationComplete: (result: SimulationResult) => void;
}

export default function SimulatePage({
  onSimulationComplete,
}: SimulatePageProps) {
  const { data: accounts, isLoading: accountsLoading } = useGetAccounts();
  const runSimulation = useRunSimulation();

  const [numSimulations, setNumSimulations] = useState("10000");
  const [timeHorizon, setTimeHorizon] = useState(20);
  const [annualContribution, setAnnualContribution] = useState("");
  const [targetValue, setTargetValue] = useState("");

  const hasAccounts = accounts && accounts.length > 0;
  const totalValue = accounts?.reduce((sum, a) => sum + a.amount, 0) ?? 0;

  const handleRunSimulation = async () => {
    if (!hasAccounts) {
      toast.error("No accounts configured", {
        description: "Add at least one account before running a simulation.",
      });
      return;
    }

    const config = {
      numSimulations: BigInt(numSimulations),
      timeHorizonYears: BigInt(timeHorizon),
      annualContribution: Number.parseFloat(annualContribution) || 0,
      ...(targetValue && Number.parseFloat(targetValue) > 0
        ? { targetValue: Number.parseFloat(targetValue) }
        : {}),
    };

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
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
        {/* ── Left: Config ── */}
        <div className="space-y-5">
          {/* Simulation engine params */}
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

          {/* Financial params */}
          <div className="rounded border border-border bg-card p-5 space-y-5 shadow-terminal-card">
            <h2 className="text-xs font-mono tracking-widest text-terminal-cyan uppercase flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" />
              Financial Parameters
            </h2>

            {/* Annual Contribution */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                Annual Contribution
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
                  value={annualContribution}
                  onChange={(e) => setAnnualContribution(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="pl-7 bg-background border-border text-foreground font-mono placeholder:text-muted-foreground/40 focus-visible:ring-terminal-cyan focus-visible:border-terminal-cyan"
                />
              </div>
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                Additional capital added each year of the simulation
              </p>
            </div>

            {/* Target Value */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                <Target className="w-3 h-3 inline mr-1 opacity-70" />
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
          </div>

          {/* Run button */}
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

        {/* ── Right: Portfolio preview ── */}
        <div className="space-y-4">
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
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Initial Value</span>
                  <span className="text-terminal-green font-bold data-value">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
                {annualContribution &&
                  Number.parseFloat(annualContribution) > 0 && (
                    <div className="flex justify-between text-xs font-mono mt-1">
                      <span className="text-muted-foreground">Annual Add</span>
                      <span className="text-terminal-cyan data-value">
                        +{formatCurrency(Number.parseFloat(annualContribution))}
                      </span>
                    </div>
                  )}
                {targetValue && Number.parseFloat(targetValue) > 0 && (
                  <div className="flex justify-between text-xs font-mono mt-1">
                    <span className="text-muted-foreground">Target</span>
                    <span className="text-terminal-amber data-value">
                      {formatCurrency(Number.parseFloat(targetValue))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sim preview card */}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
