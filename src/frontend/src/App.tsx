import { Toaster } from "@/components/ui/sonner";
import type { Client } from "@/hooks/useQueries";
import { useState } from "react";
import Layout, { type Page } from "./components/Layout";
import AccountsPage from "./pages/AccountsPage";
import ClientsPage from "./pages/ClientsPage";
import ResultsPage from "./pages/ResultsPage";
import SimulatePage from "./pages/SimulatePage";
import type { ExtendedSimulationResult } from "./utils/monteCarlo";

export default function App() {
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [activePage, setActivePage] = useState<Page>("accounts");
  const [latestResult, setLatestResult] =
    useState<ExtendedSimulationResult | null>(null);

  const handleSelectClient = (client: Client) => {
    setActiveClient(client);
    setActivePage("accounts");
    setLatestResult(null);
  };

  const handleBackToClients = () => {
    setActiveClient(null);
    setLatestResult(null);
  };

  const handleSimulationComplete = (result: ExtendedSimulationResult) => {
    setLatestResult(result);
    setActivePage("results");
  };

  const toaster = (
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
  );

  // Show clients homepage when no client is selected
  if (!activeClient) {
    return (
      <>
        <ClientsPage onSelectClient={handleSelectClient} />
        {toaster}
      </>
    );
  }

  return (
    <>
      <Layout
        activePage={activePage}
        onNavigate={setActivePage}
        activeClient={activeClient}
        onBackToClients={handleBackToClients}
      >
        {activePage === "accounts" && (
          <AccountsPage clientId={activeClient.id} />
        )}
        {activePage === "simulate" && (
          <SimulatePage
            clientId={activeClient.id}
            onSimulationComplete={handleSimulationComplete}
          />
        )}
        {activePage === "results" && (
          <ResultsPage clientId={activeClient.id} latestResult={latestResult} />
        )}
      </Layout>
      {toaster}
    </>
  );
}
