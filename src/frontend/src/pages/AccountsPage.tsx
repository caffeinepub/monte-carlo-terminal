import AccountModal from "@/components/AccountModal";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddAccount,
  useDeleteAccount,
  useGetAccounts,
  useUpdateAccount,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  getAccountTypeAbbr,
  getAccountTypeColor,
  getRiskLevel,
} from "@/utils/format";
import { Pencil, Plus, Trash2, TrendingUp, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { Account } from "../backend.d";

export default function AccountsPage() {
  const { data: accounts, isLoading } = useGetAccounts();
  const addAccount = useAddAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<bigint | null>(null);

  const totalValue = accounts?.reduce((sum, a) => sum + a.amount, 0) ?? 0;
  const avgRisk =
    accounts && accounts.length > 0
      ? accounts.reduce((sum, a) => sum + Number(a.riskScore), 0) /
        accounts.length
      : 0;

  const handleSave = async (data: {
    name: string;
    accountType: string;
    amount: number;
    riskScore: bigint;
  }) => {
    try {
      if (editAccount) {
        await updateAccount.mutateAsync({ id: editAccount.id, ...data });
        toast.success("Account updated", {
          description: `${data.name} has been modified`,
        });
      } else {
        await addAccount.mutateAsync(data);
        toast.success("Account added", {
          description: `${data.name} added to portfolio`,
        });
      }
    } catch {
      toast.error("Operation failed", {
        description: "Could not save the account. Please try again.",
      });
      throw new Error("Save failed");
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteAccount.mutateAsync(deleteId);
      toast.success("Account removed");
    } catch {
      toast.error("Could not delete account");
    }
    setDeleteId(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 font-mono">
            <span className="text-terminal-green opacity-60">›</span>
            <span className="tracking-widest uppercase">
              Portfolio Management
            </span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            Accounts
          </h1>
        </div>
        <Button
          onClick={() => {
            setEditAccount(null);
            setModalOpen(true);
          }}
          className="bg-terminal-green text-primary-foreground hover:bg-terminal-green-glow font-mono text-sm shadow-terminal-glow shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label="Total Portfolio"
          value={formatCurrency(totalValue)}
          icon={<Wallet className="w-4 h-4" />}
          accent="green"
          loading={isLoading}
        />
        <SummaryCard
          label="Total Accounts"
          value={String(accounts?.length ?? 0)}
          icon={<TrendingUp className="w-4 h-4" />}
          accent="cyan"
          loading={isLoading}
        />
        <SummaryCard
          label="Avg Risk Score"
          value={avgRisk > 0 ? avgRisk.toFixed(1) : "—"}
          icon={
            <span className="text-xs font-bold">
              {avgRisk > 0 ? getRiskLevel(Math.round(avgRisk)).label : "N/A"}
            </span>
          }
          accent={avgRisk >= 7 ? "red" : avgRisk >= 4 ? "amber" : "green"}
          loading={isLoading}
        />
      </div>

      {/* Accounts table */}
      <div className="rounded border border-border bg-card shadow-terminal-card overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_120px_80px_90px] gap-0 px-4 py-2 border-b border-border bg-background">
          {["NAME / TYPE", "TYPE", "AMOUNT", "RISK", "ACTIONS"].map((h) => (
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
            {["sk-a", "sk-b", "sk-c", "sk-d"].map((k) => (
              <div
                key={k}
                className="grid grid-cols-[1fr_100px_120px_80px_90px] gap-0 px-4 py-3"
              >
                <Skeleton className="h-4 w-36 bg-muted/50" />
                <Skeleton className="h-4 w-14 bg-muted/50" />
                <Skeleton className="h-4 w-20 bg-muted/50" />
                <Skeleton className="h-4 w-12 bg-muted/50" />
                <Skeleton className="h-4 w-16 bg-muted/50" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!accounts || accounts.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 px-4 text-center"
          >
            <div className="font-mono text-terminal-green-dim text-4xl mb-4 opacity-30">
              ▓▒░
            </div>
            <p className="text-muted-foreground text-sm font-mono mb-1">
              NO ACCOUNTS FOUND
            </p>
            <p className="text-muted-foreground/50 text-xs font-mono mb-6">
              Add your first portfolio position to begin
            </p>
            <Button
              onClick={() => {
                setEditAccount(null);
                setModalOpen(true);
              }}
              variant="outline"
              className="border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 font-mono"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Account
            </Button>
          </motion.div>
        )}

        {/* Account rows */}
        <AnimatePresence mode="popLayout">
          {accounts?.map((account, i) => {
            const risk = getRiskLevel(account.riskScore);
            const typeColor = getAccountTypeColor(account.accountType);
            const typeAbbr = getAccountTypeAbbr(account.accountType);
            return (
              <motion.div
                key={String(account.id)}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8, height: 0 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                className="grid grid-cols-[1fr_100px_120px_80px_90px] gap-0 items-center px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-accent/20 transition-colors group"
              >
                {/* Name */}
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-mono truncate">
                    {account.name}
                  </p>
                  <p className="text-muted-foreground/50 text-[10px] font-mono mt-0.5">
                    ID:{" "}
                    <span className="text-terminal-green-dim">
                      {String(account.id).padStart(4, "0")}
                    </span>
                  </p>
                </div>

                {/* Type badge */}
                <div>
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                      typeColor,
                    )}
                  >
                    {typeAbbr}
                  </span>
                  <p className="text-[9px] text-muted-foreground/40 font-mono mt-0.5 truncate">
                    {account.accountType}
                  </p>
                </div>

                {/* Amount */}
                <div className="data-value text-sm text-foreground font-mono font-medium">
                  {formatCurrency(account.amount)}
                </div>

                {/* Risk badge */}
                <div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                      risk.bg,
                      risk.color,
                    )}
                  >
                    {Number(account.riskScore)}
                    <span className="text-[8px]">{risk.label}</span>
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditAccount(account);
                      setModalOpen(true);
                    }}
                    className="h-7 w-7 text-muted-foreground hover:text-terminal-green hover:bg-terminal-green/10"
                    title="Edit account"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(account.id)}
                    className="h-7 w-7 text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10"
                    title="Delete account"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Footer total */}
        {accounts && accounts.length > 0 && (
          <div className="grid grid-cols-[1fr_100px_120px_80px_90px] gap-0 px-4 py-2 border-t border-border bg-background/50">
            <span className="text-xs font-mono text-muted-foreground">
              TOTAL ({accounts.length})
            </span>
            <span />
            <span className="data-value text-sm font-mono font-bold text-terminal-green">
              {formatCurrency(totalValue)}
            </span>
            <span />
            <span />
          </div>
        )}
      </div>

      {/* Modal */}
      <AccountModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditAccount(null);
        }}
        onSave={handleSave}
        editAccount={editAccount}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent className="bg-card border-border font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-terminal-red">
              Delete Account?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. The account will be permanently
              removed from the portfolio.
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "green" | "cyan" | "amber" | "red";
  loading?: boolean;
}) {
  const accentMap = {
    green: "text-terminal-green border-terminal-green/20 shadow-terminal",
    cyan: "text-terminal-cyan border-terminal-cyan/20",
    amber: "text-terminal-amber border-terminal-amber/20",
    red: "text-terminal-red border-terminal-red/20",
  };

  return (
    <div
      className={cn(
        "rounded border bg-card p-4 flex flex-col gap-2",
        accentMap[accent],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
          {label}
        </span>
        <span className={cn("opacity-60", accentMap[accent].split(" ")[0])}>
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-28 bg-muted/50" />
      ) : (
        <p
          className={cn(
            "data-value text-xl font-mono font-bold",
            accentMap[accent].split(" ")[0],
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}
