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
import { useActor } from "@/hooks/useActor";
import type { Client } from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  ServerCrash,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BackendAccount {
  id: bigint;
  name: string;
  accountType: string;
  amount: number;
  riskScore: bigint;
}

interface StoredAccount {
  id: string;
  name: string;
  accountType: string;
  amount: number;
  riskScore: string;
}

interface DataMigrationDialogProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const accountsKey = (clientId: string) => `mct_accounts_${clientId}`;

function loadStoredAccounts(clientId: string): StoredAccount[] {
  try {
    return JSON.parse(localStorage.getItem(accountsKey(clientId)) ?? "[]");
  } catch {
    return [];
  }
}

function mergeAccounts(
  existing: StoredAccount[],
  incoming: BackendAccount[],
): { merged: StoredAccount[]; added: number } {
  const existingNames = new Set(
    existing.map((a) => a.name.trim().toLowerCase()),
  );
  const toAdd: StoredAccount[] = [];
  const offset = Date.now();

  for (let i = 0; i < incoming.length; i++) {
    const a = incoming[i];
    const normalizedName = a.name.trim().toLowerCase();
    if (!existingNames.has(normalizedName)) {
      toAdd.push({
        id: (offset + i).toString(),
        name: a.name,
        accountType: a.accountType,
        amount: Number(a.amount),
        riskScore: a.riskScore.toString(),
      });
      existingNames.add(normalizedName);
    }
  }

  return { merged: [...existing, ...toAdd], added: toAdd.length };
}

// ─── Component ───────────────────────────────────────────────────────────────

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; accounts: BackendAccount[] }
  | { status: "empty" }
  | { status: "error"; message: string };

export default function DataMigrationDialog({
  open,
  onClose,
  clients,
}: DataMigrationDialogProps) {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [targetId, setTargetId] = useState<string>("");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [isImporting, setIsImporting] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setTargetId(clients[0]?.id ?? "");
      setFetchState({ status: "idle" });
    }
  }, [open, clients]);

  const handleFetch = async () => {
    if (!actor) {
      setFetchState({
        status: "error",
        message: "Backend actor not available. Please wait and try again.",
      });
      return;
    }
    setFetchState({ status: "loading" });
    try {
      const raw = await actor.getAccounts();
      const accounts: BackendAccount[] = raw.map((a) => ({
        id: BigInt(a.id),
        name: a.name,
        accountType: a.accountType,
        amount: Number(a.amount),
        riskScore: BigInt(a.riskScore),
      }));
      if (accounts.length === 0) {
        setFetchState({ status: "empty" });
      } else {
        setFetchState({ status: "ready", accounts });
      }
    } catch (err) {
      console.error(err);
      setFetchState({
        status: "error",
        message:
          "Could not reach the backend. The data may have been cleared or this canister was reset.",
      });
    }
  };

  const handleImport = async () => {
    if (fetchState.status !== "ready" || !targetId) return;
    setIsImporting(true);
    try {
      const existing = loadStoredAccounts(targetId);
      const { merged, added } = mergeAccounts(existing, fetchState.accounts);
      localStorage.setItem(accountsKey(targetId), JSON.stringify(merged));

      await queryClient.invalidateQueries({
        queryKey: ["accounts", targetId],
      });

      const targetClient = clients.find((c) => c.id === targetId);
      toast.success("Accounts imported", {
        description: `${added} account${added !== 1 ? "s" : ""} added to ${targetClient?.name ?? "client"}. ${fetchState.accounts.length - added} duplicate${fetchState.accounts.length - added !== 1 ? "s" : ""} skipped.`,
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Import failed", {
        description: "Could not save accounts. Please try again.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const canImport = fetchState.status === "ready" && !!targetId && !isImporting;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border font-mono max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-terminal-green font-display text-base">
            <Database className="w-4 h-4" />
            Import Legacy Accounts
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            Fetch accounts saved in the original backend (before the
            multi-client system was added) and import them into a client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Step 1: Fetch from backend */}
          <div className="space-y-2">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground">
              Step 1 — Load from backend
            </p>
            <Button
              onClick={handleFetch}
              disabled={fetchState.status === "loading" || !actor}
              variant="outline"
              className="w-full border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 font-mono text-sm"
            >
              {fetchState.status === "loading" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Fetching accounts…
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 mr-2" />
                  Fetch Accounts from Backend
                </>
              )}
            </Button>

            {/* Status feedback */}
            {fetchState.status === "ready" && (
              <div className="flex items-start gap-2 rounded border border-terminal-green/30 bg-terminal-green/5 px-3 py-2 text-xs text-terminal-green font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Found <strong>{fetchState.accounts.length}</strong> account
                  {fetchState.accounts.length !== 1 ? "s" : ""} in the backend:{" "}
                  {fetchState.accounts.map((a) => a.name).join(", ")}.
                </span>
              </div>
            )}

            {fetchState.status === "empty" && (
              <div className="flex items-start gap-2 rounded border border-terminal-amber/30 bg-terminal-amber/5 px-3 py-2 text-xs text-terminal-amber font-mono">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  No accounts found in the backend. They may have already been
                  migrated or the canister was reset.
                </span>
              </div>
            )}

            {fetchState.status === "error" && (
              <div className="flex items-start gap-2 rounded border border-terminal-red/30 bg-terminal-red/5 px-3 py-2 text-xs text-terminal-red font-mono">
                <ServerCrash className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{fetchState.message}</span>
              </div>
            )}
          </div>

          {/* Step 2: Pick destination */}
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground">
              Step 2 — Destination client
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
                    className="font-mono text-sm"
                  >
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/50 font-mono">
              Existing accounts in the destination are preserved — duplicates
              (by name) are skipped.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border text-muted-foreground hover:text-foreground font-mono text-sm flex-1"
          >
            Cancel
          </Button>
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
                Import Accounts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
