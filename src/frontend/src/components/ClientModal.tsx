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
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Loader2, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

type RiskProfile = Client["riskProfile"];

const RISK_PROFILES: RiskProfile[] = [
  "Conservative",
  "Moderate",
  "Aggressive",
  "Custom",
];

interface ClientModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Client, "id" | "createdAt">) => Promise<void>;
  editClient?: Client | null;
}

export default function ClientModal({
  open,
  onClose,
  onSave,
  editClient,
}: ClientModalProps) {
  const [name, setName] = useState("");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("Moderate");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (editClient) {
        setName(editClient.name);
        setRiskProfile(editClient.riskProfile);
        setTargetDate(editClient.targetDate);
        setNotes(editClient.notes);
      } else {
        setName("");
        setRiskProfile("Moderate");
        setTargetDate("");
        setNotes("");
      }
      setErrors({});
    }
  }, [open, editClient]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Client name is required";
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      errs.targetDate = "Use YYYY-MM-DD format";
    }
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
        riskProfile,
        targetDate: targetDate.trim(),
        notes: notes.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const riskColors: Record<RiskProfile, string> = {
    Conservative: "text-terminal-green border-terminal-green/30",
    Moderate: "text-terminal-amber border-terminal-amber/30",
    Aggressive: "text-terminal-red border-terminal-red/30",
    Custom: "text-terminal-cyan border-terminal-cyan/30",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-terminal-border max-w-md shadow-terminal font-mono p-0 overflow-hidden">
        {/* Header */}
        <div className="scanlines px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-terminal-green font-mono text-base tracking-wide">
              {editClient ? "› EDIT CLIENT" : "› NEW CLIENT"}
            </DialogTitle>
            <p className="text-muted-foreground text-xs">
              {editClient
                ? `Modifying profile for ${editClient.name}`
                : "Register a new client profile"}
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">
              Client Name <span className="text-terminal-red">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder="e.g., John Doe"
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

          {/* Risk Profile */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">
              Risk Profile
            </Label>
            <Select
              value={riskProfile}
              onValueChange={(v) => setRiskProfile(v as RiskProfile)}
            >
              <SelectTrigger className="bg-background border-border text-foreground font-mono focus:ring-terminal-green focus:border-terminal-green">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border font-mono">
                {RISK_PROFILES.map((p) => (
                  <SelectItem
                    key={p}
                    value={p}
                    className="text-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <span
                      className={cn("font-bold", riskColors[p].split(" ")[0])}
                    >
                      {p}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Date */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">
              Target Date{" "}
              <span className="text-muted-foreground/40 normal-case tracking-normal text-[10px] ml-1">
                (optional)
              </span>
            </Label>
            <Input
              value={targetDate}
              onChange={(e) => {
                setTargetDate(e.target.value);
                setErrors((prev) => ({ ...prev, targetDate: "" }));
              }}
              placeholder="YYYY-MM-DD"
              className={cn(
                "bg-background border-border text-foreground font-mono placeholder:text-muted-foreground/40 focus-visible:ring-terminal-green focus-visible:border-terminal-green",
                errors.targetDate &&
                  "border-terminal-red focus-visible:ring-terminal-red",
              )}
            />
            {errors.targetDate && (
              <p className="text-terminal-red text-xs">{errors.targetDate}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest">
              Notes{" "}
              <span className="text-muted-foreground/40 normal-case tracking-normal text-[10px] ml-1">
                (optional)
              </span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Client goals, context, or special considerations..."
              rows={3}
              className="bg-background border-border text-foreground font-mono text-sm placeholder:text-muted-foreground/30 focus-visible:ring-terminal-green focus-visible:border-terminal-green resize-none"
            />
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
            {saving ? "Saving..." : editClient ? "Save Changes" : "Add Client"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
