import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  ChevronRight,
  LayoutDashboard,
  Menu,
  TrendingUp,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

export type Page = "accounts" | "simulate" | "results";

interface NavItem {
  id: Page;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
}

const navItems: NavItem[] = [
  { id: "accounts", label: "Accounts", icon: LayoutDashboard, shortcut: "F1" },
  { id: "simulate", label: "Simulate", icon: Activity, shortcut: "F2" },
  { id: "results", label: "Results", icon: BarChart3, shortcut: "F3" },
];

interface LayoutProps {
  children: React.ReactNode;
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function Layout({
  children,
  activePage,
  onNavigate,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-sidebar shrink-0">
        {/* Brand */}
        <div className="scanlines px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="status-dot" />
            <span className="text-xs text-terminal-green-dim font-mono tracking-widest uppercase opacity-70">
              System Online
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-terminal-green shrink-0" />
            <div>
              <h1 className="text-terminal-green font-display font-bold text-sm leading-tight tracking-tight cursor-blink">
                MONTE CARLO
              </h1>
              <p className="text-terminal-green-dim text-[10px] tracking-widest uppercase opacity-70">
                Terminal v1.0
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          <p className="px-2 mb-2 text-[10px] font-mono tracking-widest text-muted-foreground uppercase opacity-50">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-mono transition-all duration-150 group",
                  isActive
                    ? "bg-sidebar-accent text-terminal-green shadow-terminal-active"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive
                      ? "text-terminal-green"
                      : "text-muted-foreground group-hover:text-terminal-green-dim",
                  )}
                />
                <span className="flex-1 text-left">{item.label}</span>
                <span
                  className={cn(
                    "text-[10px] tracking-wider font-mono opacity-40",
                    isActive && "opacity-70 text-terminal-green",
                  )}
                >
                  {item.shortcut}
                </span>
                {isActive && (
                  <ChevronRight className="w-3 h-3 text-terminal-green opacity-70" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-[10px] font-mono text-muted-foreground opacity-40 leading-relaxed">
            © {new Date().getFullYear()}.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-terminal-green-dim transition-colors"
            >
              Built with caffeine.ai
            </a>
          </p>
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-56 flex flex-col bg-sidebar border-r border-sidebar-border md:hidden"
            >
              <div className="scanlines px-4 py-5 border-b border-sidebar-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="status-dot" />
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-terminal-green" />
                      <h1 className="text-terminal-green font-bold text-sm cursor-blink">
                        MONTE CARLO
                      </h1>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(false)}
                    className="text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <nav className="flex-1 px-2 py-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-mono transition-all",
                        isActive
                          ? "bg-sidebar-accent text-terminal-green shadow-terminal-active"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4",
                          isActive
                            ? "text-terminal-green"
                            : "text-muted-foreground",
                        )}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <TrendingUp className="w-4 h-4 text-terminal-green" />
          <span className="text-terminal-green font-mono text-sm font-bold cursor-blink">
            MONTE CARLO
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
