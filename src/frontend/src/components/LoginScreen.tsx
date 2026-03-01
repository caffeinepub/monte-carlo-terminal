import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Terminal, Zap } from "lucide-react";
import { motion } from "motion/react";

interface LoginScreenProps {
  onLogin: () => void;
  isLoggingIn: boolean;
}

const TERMINAL_LINES = [
  "Initializing Monte Carlo engine...",
  "Loading stochastic simulation modules...",
  "Connecting to Internet Computer network...",
  "Awaiting authentication...",
];

export default function LoginScreen({
  onLogin,
  isLoggingIn,
}: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden scanlines noise-overlay">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(var(--terminal-green)) 1px, transparent 1px), linear-gradient(90deg, oklch(var(--terminal-green)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Subtle radial glow behind the card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(var(--terminal-green) / 0.06) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-6"
      >
        {/* Logo block */}
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative mb-5"
          >
            <div className="w-16 h-16 rounded border border-terminal-green/30 bg-terminal-green/5 flex items-center justify-center shadow-terminal">
              <Terminal className="w-8 h-8 text-terminal-green" />
            </div>
            <div className="status-dot absolute -top-1 -right-1" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-terminal-green font-display font-bold text-2xl tracking-tight text-center leading-none mb-1 glow-green"
          >
            MONTE CARLO TERMINAL
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground text-xs font-mono tracking-widest uppercase text-center"
          >
            Secure · Private · On-Chain
          </motion.p>
        </div>

        {/* Terminal boot lines */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="rounded border border-border bg-card/60 px-4 py-3 mb-6 space-y-1"
        >
          {TERMINAL_LINES.map((line, i) => (
            <motion.p
              key={line}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: i < 3 ? 0.45 : 0.9 }}
              transition={{ delay: 0.4 + i * 0.08 }}
              className="text-[11px] font-mono text-terminal-green-dim terminal-prefix"
            >
              {line}
            </motion.p>
          ))}
        </motion.div>

        {/* Auth card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="rounded border border-terminal-green/20 bg-card shadow-terminal-card p-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-terminal-green" />
            <h2 className="text-foreground font-display font-bold text-sm tracking-wide">
              Authentication Required
            </h2>
          </div>
          <p className="text-muted-foreground text-xs font-mono mb-5 leading-relaxed">
            Your client data is encrypted and tied to your Internet Identity.
            Only you can access your workspace.
          </p>

          <Button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="w-full bg-terminal-green text-primary-foreground hover:bg-terminal-green-glow font-mono font-bold text-sm shadow-terminal-glow h-11"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting to Internet Identity...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Connect with Internet Identity
              </>
            )}
          </Button>

          <p className="text-muted-foreground/40 text-[10px] font-mono text-center mt-3">
            No passwords. No email. Powered by the Internet Computer.
          </p>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-[10px] font-mono text-muted-foreground/30 mt-8"
        >
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-terminal-green-dim transition-colors"
          >
            Built with love using caffeine.ai
          </a>
        </motion.p>
      </motion.div>
    </div>
  );
}
