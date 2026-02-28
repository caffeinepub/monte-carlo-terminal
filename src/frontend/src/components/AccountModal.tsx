import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getRiskLevel } from "@/utils/format";
import { Loader2, Save, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Account } from "../backend.d";

const ACCOUNT_TYPES = [
  "Equity",
  "Bond",
  "Cash",
  "Real Estate",
  "Crypto",
  "Commodities",
  "Alternative",
];

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    accountType: string;
    amount: number;
    riskScore: bigint;
  }) => Promise<void>;
  editAccount?: Account | null;
}

export default function AccountModal({
  open,
  onClose,
  onSave,
  editAccount,
}: AccountModalProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("Equity");
  const [amount, setAmount] = useState("");
  const [riskScore, setRiskScore] = useState(5);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (editAccount) {
        setName(editAccount.name);
        setAccountType(editAccount.accountType);
        setAmount(editAccount.amount.toString());
        setRiskScore(Number(editAccount.riskScore));
      } else {
        setName("");
        setAccountType("Equity");
        setAmount("");
        setRiskScore(5);
      }
      setErrors({});
    }
  }, [open, editAccount]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    const amtNum = Number.parseFloat(amount);
    if (!amount || Number.isNaN(amtNum) || amtNum <= 0)
      errs.amount = "Enter a valid positive amount";
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        accountType,
        amount: Number.parseFloat(amount),
        riskScore: BigInt(riskScore),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const risk = getRiskLevel(riskScore);
  const riskTicks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-terminal-border max-w-md shadow-terminal font-mono p-0 overflow-hidden">
        {/* Header scanline */}
        <div className="scanlines px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-terminal-green font-mono text-base tracking-wide">
              {editAccount ? "› EDIT ACCOUNT" : "› NEW ACCOUNT"}
            </DialogTitle>
            <p className="text-muted-foreground text-xs">
              {editAccount
                ? `Modifying record #${editAccount.id}`
                : "Configure a new portfolio position"}
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">
              Account Name
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder="e.g., Vanguard S&P 500"
              className={cn(
                "bg-background border-border text-foreground font-mono placeholder:text-muted-foreground/40 focus-visible:ring-terminal-green focus-visible:border-terminal-green",
                errors.name &&
                  "border-terminal-red focus-visible:ring-terminal-red",
              )}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            {errors.name && (
              <p className="text-terminal-red text-xs">{errors.name}</p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">
              Asset Type
            </Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger className="bg-background border-border text-foreground font-mono focus:ring-terminal-green focus:border-terminal-green">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border font-mono">
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem
                    key={t}
                    value={t}
                    className="text-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">
              Amount (USD)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">
                $
              </span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((prev) => ({ ...prev, amount: "" }));
                }}
                placeholder="0"
                min="0"
                step="0.01"
                className={cn(
                  "pl-7 bg-background border-border text-foreground font-mono placeholder:text-muted-foreground/40 focus-visible:ring-terminal-green focus-visible:border-terminal-green",
                  errors.amount &&
                    "border-terminal-red focus-visible:ring-terminal-red",
                )}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            {errors.amount && (
              <p className="text-terminal-red text-xs">{errors.amount}</p>
            )}
          </div>

          {/* Risk Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                Risk Score
              </Label>
              <motion.div
                key={riskScore}
                initial={{ scale: 0.85, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  "flex items-center gap-2 px-2 py-0.5 rounded text-xs font-mono font-bold",
                  risk.bg,
                  risk.color,
                )}
              >
                <span className="text-base font-bold">{riskScore}</span>
                <span className="text-[10px] tracking-widest">
                  {risk.label}
                </span>
              </motion.div>
            </div>

            <div className="px-1">
              <Slider
                value={[riskScore]}
                onValueChange={([v]) => setRiskScore(v)}
                min={1}
                max={10}
                step={1}
                className="[&>[data-slot=slider-track]]:bg-border [&>[data-slot=slider-range]]:bg-terminal-green [&>[data-slot=slider-thumb]]:border-terminal-green [&>[data-slot=slider-thumb]]:bg-background [&>[data-slot=slider-thumb]]:shadow-terminal"
              />
              <div className="flex justify-between mt-2">
                {riskTicks.map((t) => (
                  <span
                    key={t}
                    className={cn(
                      "text-[9px] font-mono transition-colors",
                      t === riskScore ? risk.color : "text-muted-foreground/30",
                    )}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Risk spectrum bar */}
            <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
              <div className="flex-[3] bg-terminal-green/70" />
              <div className="flex-[3] bg-terminal-amber/70" />
              <div className="flex-[2] bg-orange-400/70" />
              <div className="flex-[2] bg-terminal-red/70" />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/50 font-mono">
              <span>1 LOW</span>
              <span>4 MED</span>
              <span>7 HIGH</span>
              <span>9 V.HIGH</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-border text-muted-foreground hover:bg-secondary hover:text-foreground font-mono"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-terminal-green text-primary-foreground hover:bg-terminal-green-glow font-mono font-bold shadow-terminal-glow"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "Saving..." : "Save Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
