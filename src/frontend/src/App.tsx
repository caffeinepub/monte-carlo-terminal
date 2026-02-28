import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import type { SimulationResult } from "./backend.d";
import Layout, { type Page } from "./components/Layout";
import AccountsPage from "./pages/AccountsPage";
import ResultsPage from "./pages/ResultsPage";
import SimulatePage from "./pages/SimulatePage";

export default function App() {
  const [activePage, setActivePage] = useState<Page>("accounts");
  const [latestResult, setLatestResult] = useState<SimulationResult | null>(
    null,
  );

  const handleSimulationComplete = (result: SimulationResult) => {
    setLatestResult(result);
    setActivePage("results");
  };

  return (
    <>
      <Layout activePage={activePage} onNavigate={setActivePage}>
        {activePage === "accounts" && <AccountsPage />}
        {activePage === "simulate" && (
          <SimulatePage onSimulationComplete={handleSimulationComplete} />
        )}
        {activePage === "results" && (
          <ResultsPage latestResult={latestResult} />
        )}
      </Layout>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "bg-popover border-border font-mono text-sm text-foreground shadow-terminal-card",
            title: "text-foreground font-bold",
            description: "text-muted-foreground",
            success: "border-terminal-green/30",
            error: "border-terminal-red/30",
          },
        }}
      />
    </>
  );
}
