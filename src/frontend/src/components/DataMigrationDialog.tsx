import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Client } from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Database,
  FileArchive,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

interface MigrationSource {
  clientId: string;
  label: string;
  accountCount: number;
  simCount: number;
  scenarioCount: number;
  isOrphaned: boolean;
}

interface DataMigrationDialogProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  defaultTargetName?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findMigrationSources(clients: Client[]): MigrationSource[] {
  const knownIds = new Set(clients.map((c) => c.id));
  const sources: MigrationSource[] = [];
  const scanned = new Set<string>();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("mct_accounts_")) continue;
    const clientId = key.replace("mct_accounts_", "");
    if (!clientId || scanned.has(clientId)) continue;
    scanned.add(clientId);

    let accountData: unknown[] = [];
    let simData: unknown[] = [];
    let scenarioData: unknown[] = [];

    try {
      accountData = JSON.parse(
        localStorage.getItem(`mct_accounts_${clientId}`) ?? "[]",
      );
    } catch {
      /* ignore */
    }
    try {
      simData = JSON.parse(
        localStorage.getItem(`mct_sims_${clientId}`) ?? "[]",
      );
    } catch {
      /* ignore */
    }
    try {
      scenarioData = JSON.parse(
        localStorage.getItem(`mct_scenarios_${clientId}`) ?? "[]",
      );
    } catch {
      /* ignore */
    }

    if (
      accountData.length === 0 &&
      simData.length === 0 &&
      scenarioData.length === 0
    )
      continue;

    const isOrphaned = !knownIds.has(clientId);
    const existingClient = clients.find((c) => c.id === clientId);

    sources.push({
      clientId,
      label: isOrphaned
        ? `Legacy Data (ID: …${clientId.slice(-6)})`
        : (existingClient?.name ?? clientId),
      accountCount: Array.isArray(accountData) ? accountData.length : 0,
      simCount: Array.isArray(simData) ? simData.length : 0,
      scenarioCount: Array.isArray(scenarioData) ? scenarioData.length : 0,
      isOrphaned,
    });
  }

  // Orphaned sources first
  return sources.sort(
    (a, b) => (b.isOrphaned ? 1 : 0) - (a.isOrphaned ? 1 : 0),
  );
}

function migrateData(sourceId: string, targetId: string): void {
  // ── Accounts ─────────────────────────────────────────────────────────────
  const srcAccountsRaw = localStorage.getItem(`mct_accounts_${sourceId}`);
  if (srcAccountsRaw) {
    let srcAccounts: Array<Record<string, unknown>> = [];
    try {
      srcAccounts = JSON.parse(srcAccountsRaw);
    } catch {
      /* ignore */
    }

    let dstAccounts: Array<Record<string, unknown>> = [];
    try {
      dstAccounts = JSON.parse(
        localStorage.getItem(`mct_accounts_${targetId}`) ?? "[]",
      );
    } catch {
      /* ignore */
    }

    const existingIds = new Set(dstAccounts.map((a) => String(a.id)));
    const toAdd = srcAccounts.filter((a) => !existingIds.has(String(a.id)));
    // Re-stamp IDs to avoid collisions: prefix with epoch offset
    const offset = Date.now();
    const remapped: Record<string, string> = {};
    const addWithNewIds = toAdd.map((a, i) => {
      const newId = (offset + i).toString();
      remapped[String(a.id)] = newId;
      return { ...a, id: newId };
    });
    localStorage.setItem(
      `mct_accounts_${targetId}`,
      JSON.stringify([...dstAccounts, ...addWithNewIds]),
    );

    // ── Simulations ─────────────────────────────────────────────────────────
    const srcSimsRaw = localStorage.getItem(`mct_sims_${sourceId}`);
    if (srcSimsRaw) {
      let srcSims: Array<Record<string, unknown>> = [];
      try {
        srcSims = JSON.parse(srcSimsRaw);
      } catch {
        /* ignore */
      }

      let dstSims: Array<Record<string, unknown>> = [];
      try {
        dstSims = JSON.parse(
          localStorage.getItem(`mct_sims_${targetId}`) ?? "[]",
        );
      } catch {
        /* ignore */
      }

      const existingSimIds = new Set(dstSims.map((s) => String(s.id)));
      // Also re-map accountId references in accountOverrides
      const simsToAdd = srcSims
        .filter((s) => !existingSimIds.has(String(s.id)))
        .map((s, i) => {
          const newSimId = (offset + 10000 + i).toString();
          // Remap accountOverrides
          let config = s.config as Record<string, unknown> | undefined;
          if (config) {
            const overrides = (
              config.accountOverrides as Array<Record<string, unknown>>
            )?.map((o) => ({
              ...o,
              accountId: remapped[String(o.accountId)] ?? o.accountId,
            }));
            config = { ...config, accountOverrides: overrides ?? [] };
          }
          return { ...s, id: newSimId, config };
        });

      localStorage.setItem(
        `mct_sims_${targetId}`,
        JSON.stringify([...dstSims, ...simsToAdd]),
      );
    }

    // ── Scenarios ────────────────────────────────────────────────────────────
    const srcScenariosRaw = localStorage.getItem(`mct_scenarios_${sourceId}`);
    if (srcScenariosRaw) {
      let srcScenarios: Array<Record<string, unknown>> = [];
      try {
        srcScenarios = JSON.parse(srcScenariosRaw);
      } catch {
        /* ignore */
      }

      let dstScenarios: Array<Record<string, unknown>> = [];
      try {
        dstScenarios = JSON.parse(
          localStorage.getItem(`mct_scenarios_${targetId}`) ?? "[]",
        );
      } catch {
        /* ignore */
      }

      const existingScenarioIds = new Set(
        dstScenarios.map((s) => String(s.id)),
      );
      const scenariosToAdd = srcScenarios
        .filter((s) => !existingScenarioIds.has(String(s.id)))
        .map((s, i) => {
          const newId = (offset + 20000 + i).toString();
          let config = s.config as Record<string, unknown> | undefined;
          if (config) {
            const overrides = (
              config.accountOverrides as Array<Record<string, unknown>>
            )?.map((o) => ({
              ...o,
              accountId: remapped[String(o.accountId)] ?? o.accountId,
            }));
            config = { ...config, accountOverrides: overrides ?? [] };
          }
          return { ...s, id: newId, config };
        });

      localStorage.setItem(
        `mct_scenarios_${targetId}`,
        JSON.stringify([...dstScenarios, ...scenariosToAdd]),
      );
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DataMigrationDialog({
  open,
  onClose,
  clients,
  defaultTargetName,
}: DataMigrationDialogProps) {
  const queryClient = useQueryClient();

  const sources = useMemo(
    () => (open ? findMigrationSources(clients) : []),
    [open, clients],
  );

  const defaultTarget = useMemo(() => {
    if (!defaultTargetName) return clients[0]?.id ?? "";
    const match = clients.find((c) =>
      c.name.toLowerCase().includes(defaultTargetName.toLowerCase()),
    );
    return match?.id ?? clients[0]?.id ?? "";
  }, [clients, defaultTargetName]);

  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setSourceId(sources[0]?.clientId ?? "");
      setTargetId(defaultTarget);
    }
  }, [open, sources, defaultTarget]);

  const selectedSource = sources.find((s) => s.clientId === sourceId);
  const selectedTarget = clients.find((c) => c.id === targetId);

  const handleImport = async () => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setIsImporting(true);
    try {
      migrateData(sourceId, targetId);
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({
        queryKey: ["accounts", targetId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["simulationHistory", targetId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["scenarios", targetId],
      });
      toast.success("Data imported successfully", {
        description: `${selectedSource?.accountCount ?? 0} accounts, ${selectedSource?.simCount ?? 0} simulations, and ${selectedSource?.scenarioCount ?? 0} scenarios copied to ${selectedTarget?.name}.`,
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Import failed", {
        description: "Could not migrate data. Please try again.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const canImport =
    !!sourceId && !!targetId && sourceId !== targetId && !isImporting;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border font-mono max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-terminal-green font-display text-base">
            <Database className="w-4 h-4" />
            Import Legacy Data
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            Copy accounts, simulations, and scenarios from a previous workspace
            into a client. Existing data is preserved — no duplicates created.
          </DialogDescription>
        </DialogHeader>

        {sources.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <FileArchive className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              No legacy data found in storage.
            </p>
            <p className="text-muted-foreground/50 text-xs">
              All existing data is already assigned to registered clients.
            </p>
          </div>
        ) : (
          <div className="space-y-5 py-1">
            {/* Source */}
            <div className="space-y-1.5">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground">
                Source
              </p>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger className="bg-background border-border text-foreground font-mono text-sm">
                  <SelectValue placeholder="Select data source…" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border font-mono">
                  {sources.map((s) => (
                    <SelectItem
                      key={s.clientId}
                      value={s.clientId}
                      className="font-mono text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {s.isOrphaned && (
                          <span className="text-terminal-amber text-[10px] border border-terminal-amber/40 bg-terminal-amber/10 px-1 py-0.5 rounded font-bold">
                            LEGACY
                          </span>
                        )}
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Source preview */}
              {selectedSource && (
                <div className="rounded border border-border/60 bg-background/60 px-3 py-2.5 mt-2 space-y-1.5">
                  <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">
                    Contents
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: "Accounts",
                        count: selectedSource.accountCount,
                      },
                      {
                        label: "Simulations",
                        count: selectedSource.simCount,
                      },
                      {
                        label: "Scenarios",
                        count: selectedSource.scenarioCount,
                      },
                    ].map(({ label, count }) => (
                      <div
                        key={label}
                        className="text-center rounded border border-border/40 bg-background py-1.5"
                      >
                        <p
                          className={`text-lg font-bold font-mono ${count > 0 ? "text-terminal-green" : "text-muted-foreground/30"}`}
                        >
                          {count}
                        </p>
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Arrow divider */}
            <div className="flex items-center gap-2 text-muted-foreground/30">
              <Separator className="flex-1 bg-border/40" />
              <ArrowRight className="w-3.5 h-3.5 text-terminal-green/50" />
              <Separator className="flex-1 bg-border/40" />
            </div>

            {/* Target */}
            <div className="space-y-1.5">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground">
                Destination Client
              </p>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="bg-background border-border text-foreground font-mono text-sm">
                  <SelectValue placeholder="Select target client…" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border font-mono">
                  {clients.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      disabled={c.id === sourceId}
                      className="font-mono text-sm"
                    >
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warning if source === target */}
            {sourceId && targetId && sourceId === targetId && (
              <div className="flex items-start gap-2 rounded border border-terminal-amber/30 bg-terminal-amber/5 px-3 py-2 text-xs text-terminal-amber font-mono">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Source and destination cannot be the same client.</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border text-muted-foreground hover:text-foreground font-mono text-sm flex-1"
          >
            Cancel
          </Button>
          {sources.length > 0 && (
            <Button
              onClick={handleImport}
              disabled={!canImport}
              className="bg-terminal-green text-primary-foreground hover:bg-terminal-green-glow shadow-terminal-glow font-mono text-sm flex-1"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 mr-2" />
                  Import Data
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
