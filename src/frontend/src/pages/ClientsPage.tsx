import ClientModal from "@/components/ClientModal";
import DataMigrationDialog from "@/components/DataMigrationDialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { Client } from "@/hooks/useQueries";
import {
  useAddClient,
  useDeleteClient,
  useGetClients,
  useUpdateClient,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Database,
  Pencil,
  Plus,
  Terminal,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ClientsPageProps {
  onSelectClient: (client: Client) => void;
}

const RISK_BADGE: Record<
  Client["riskProfile"],
  { label: string; className: string }
> = {
  Conservative: {
    label: "Conservative",
    className:
      "text-terminal-green border-terminal-green/40 bg-terminal-green/10",
  },
  Moderate: {
    label: "Moderate",
    className:
      "text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10",
  },
  Aggressive: {
    label: "Aggressive",
    className: "text-terminal-red border-terminal-red/40 bg-terminal-red/10",
  },
  Custom: {
    label: "Custom",
    className: "text-terminal-cyan border-terminal-cyan/40 bg-terminal-cyan/10",
  },
};

function AccountCount({ clientId }: { clientId: string }) {
  const key = `mct_accounts_${clientId}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return <span className="text-muted-foreground/40">0</span>;
    const parsed = JSON.parse(raw);
    const count = Array.isArray(parsed) ? parsed.length : 0;
    return (
      <span
        className={
          count > 0
            ? "text-terminal-green font-bold"
            : "text-muted-foreground/40"
        }
      >
        {count}
      </span>
    );
  } catch {
    return <span className="text-muted-foreground/40">0</span>;
  }
}

export default function ClientsPage({ onSelectClient }: ClientsPageProps) {
  const { data: clients, isLoading } = useGetClients();
  const addClient = useAddClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [hasMigrationSources, setHasMigrationSources] = useState(false);

  // Detect orphaned/legacy data in localStorage (any mct_accounts_ key not in current clients)
  useEffect(() => {
    const knownIds = new Set((clients ?? []).map((c) => c.id));
    let found = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("mct_accounts_")) continue;
      const clientId = key.replace("mct_accounts_", "");
      if (!clientId) continue;
      if (knownIds.has(clientId)) continue; // skip known clients
      try {
        const data = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (Array.isArray(data) && data.length > 0) {
          found = true;
          break;
        }
      } catch {
        /* ignore */
      }
    }
    setHasMigrationSources(found);
  }, [clients]);

  const handleSave = async (data: Omit<Client, "id" | "createdAt">) => {
    try {
      if (editClient) {
        await updateClient.mutateAsync({ id: editClient.id, data });
        toast.success("Client updated", {
          description: `${data.name}'s profile has been modified`,
        });
      } else {
        await addClient.mutateAsync(data);
        toast.success("Client added", {
          description: `${data.name} has been added`,
        });
      }
    } catch {
      toast.error("Operation failed", {
        description: "Could not save the client. Please try again.",
      });
      throw new Error("Save failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const client = clients?.find((c) => c.id === deleteId);
    try {
      await deleteClient.mutateAsync(deleteId);
      toast.success("Client removed", {
        description: client
          ? `${client.name} and all associated data has been deleted`
          : undefined,
      });
    } catch {
      toast.error("Could not delete client");
    }
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-border bg-sidebar scanlines shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo / brand */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Terminal className="w-6 h-6 text-terminal-green" />
                <div className="status-dot absolute -top-0.5 -right-0.5" />
              </div>
              <div>
                <h1 className="text-terminal-green font-display font-bold text-base leading-none tracking-tight cursor-blink">
                  MONTE CARLO TERMINAL
                </h1>
                <p className="text-terminal-green-dim text-[10px] tracking-widest uppercase opacity-60 mt-0.5">
                  Client Management
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasMigrationSources && (
              <Button
                variant="outline"
                onClick={() => setMigrationOpen(true)}
                className="border-terminal-amber/40 text-terminal-amber hover:bg-terminal-amber/10 font-mono text-sm shrink-0"
              >
                <Database className="w-4 h-4 mr-2" />
                Import Legacy Data
              </Button>
            )}
            <Button
              onClick={() => {
                setEditClient(null);
                setModalOpen(true);
              }}
              className="bg-terminal-green text-primary-foreground hover:bg-terminal-green-glow font-mono text-sm shadow-terminal-glow shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Page title + summary */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-mono">
              <span className="text-terminal-green opacity-60">›</span>
              <span className="tracking-widest uppercase">Command Center</span>
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">
              Clients
            </h2>
          </div>
          {clients && clients.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground/60 pb-1">
              <Users className="w-3.5 h-3.5" />
              <span>
                {clients.length} client{clients.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* ── Clients table ── */}
        <div className="rounded border border-border bg-card shadow-terminal-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1.6fr_130px_130px_1fr_60px_110px] gap-0 px-5 py-2.5 border-b border-border bg-background">
            {[
              "NAME",
              "RISK PROFILE",
              "TARGET DATE",
              "NOTES",
              "ACCTS",
              "ACTIONS",
            ].map((h) => (
              <span
                key={h}
                className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase"
              >
                {h}
              </span>
            ))}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="divide-y divide-border">
              {["sk-a", "sk-b", "sk-c"].map((k) => (
                <div
                  key={k}
                  className="grid grid-cols-[1.6fr_130px_130px_1fr_60px_110px] gap-0 px-5 py-4"
                >
                  <Skeleton className="h-4 w-36 bg-muted/50" />
                  <Skeleton className="h-4 w-24 bg-muted/50" />
                  <Skeleton className="h-4 w-20 bg-muted/50" />
                  <Skeleton className="h-4 w-32 bg-muted/50" />
                  <Skeleton className="h-4 w-6 bg-muted/50" />
                  <Skeleton className="h-4 w-20 bg-muted/50" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && (!clients || clients.length === 0) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 px-4 text-center"
            >
              <div className="font-mono text-terminal-green-dim text-4xl mb-4 opacity-30">
                ▓▒░
              </div>
              <p className="text-muted-foreground text-sm font-mono mb-1">
                NO CLIENTS REGISTERED
              </p>
              <p className="text-muted-foreground/50 text-xs font-mono mb-6">
                Add your first client to get started
              </p>
              <Button
                onClick={() => {
                  setEditClient(null);
                  setModalOpen(true);
                }}
                variant="outline"
                className="border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 font-mono"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Client
              </Button>
            </motion.div>
          )}

          {/* Client rows */}
          <AnimatePresence mode="popLayout">
            {clients?.map((client, i) => {
              const badge = RISK_BADGE[client.riskProfile];
              return (
                <motion.div
                  key={client.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, height: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.03 }}
                  className="grid grid-cols-[1.6fr_130px_130px_1fr_60px_110px] gap-0 items-center px-5 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-accent/20 transition-colors group"
                >
                  {/* Name */}
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-mono font-medium truncate">
                      {client.name}
                    </p>
                    <p className="text-muted-foreground/40 text-[10px] font-mono mt-0.5">
                      Added{" "}
                      <span className="text-terminal-green-dim">
                        {new Date(client.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>

                  {/* Risk Profile badge */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Target Date */}
                  <div className="font-mono text-xs text-foreground/70">
                    {client.targetDate ? (
                      client.targetDate
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="min-w-0 pr-2">
                    {client.notes ? (
                      <p className="text-muted-foreground text-xs font-mono truncate">
                        {client.notes}
                      </p>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs font-mono">
                        —
                      </span>
                    )}
                  </div>

                  {/* Account count */}
                  <div className="text-sm font-mono text-center">
                    <AccountCount clientId={client.id} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditClient(client);
                        setModalOpen(true);
                      }}
                      className="h-7 w-7 text-muted-foreground hover:text-terminal-green hover:bg-terminal-green/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit client"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(client.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete client"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onSelectClient(client)}
                      className="h-7 px-2.5 text-[10px] font-mono bg-terminal-green text-primary-foreground hover:bg-terminal-green-glow shadow-terminal-glow font-bold"
                    >
                      Open
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer row with client count */}
        {clients && clients.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/40">
            <TrendingUp className="w-3 h-3" />
            <span>
              {clients.length} registered client
              {clients.length !== 1 ? "s" : ""}
              {" · "}click Open to enter a client's workspace
            </span>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 shrink-0">
        <p className="text-center text-[10px] font-mono text-muted-foreground/40">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-terminal-green-dim transition-colors"
          >
            Built with love using caffeine.ai
          </a>
        </p>
      </footer>

      {/* Modals */}
      <ClientModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditClient(null);
        }}
        onSave={handleSave}
        editClient={editClient}
      />

      <DataMigrationDialog
        open={migrationOpen}
        onClose={() => setMigrationOpen(false)}
        clients={clients ?? []}
        defaultTargetName="Eric Chartier"
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent className="bg-card border-border font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-terminal-red">
              Delete Client?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently remove the client and all their accounts,
              simulations, and scenarios. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border font-mono">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-terminal-red text-destructive-foreground hover:bg-terminal-red/80 font-mono"
            >
              Delete Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
