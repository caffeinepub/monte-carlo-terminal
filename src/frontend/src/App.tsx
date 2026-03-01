import { Toaster } from "@/components/ui/sonner";
import type { Client } from "@/hooks/useQueries";
import { Terminal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import Layout, { type Page } from "./components/Layout";
import LoginScreen from "./components/LoginScreen";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import AccountsPage from "./pages/AccountsPage";
import ClientsPage from "./pages/ClientsPage";
import ResultsPage from "./pages/ResultsPage";
import SimulatePage from "./pages/SimulatePage";
import type { ExtendedSimulationResult } from "./utils/monteCarlo";

function BootScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center scanlines">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <Terminal className="w-8 h-8 text-terminal-green animate-pulse" />
          <div className="status-dot absolute -top-0.5 -right-0.5" />
        </div>
        <p className="text-terminal-green-dim text-xs font-mono tracking-widest animate-pulse">
          INITIALIZING...
        </p>
      </motion.div>
    </div>
  );
}

export default function App() {
  const { identity, login, clear, isInitializing, isLoggingIn } =
    useInternetIdentity();

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

  // 1. Initializing — show boot screen
  if (isInitializing) {
    return <BootScreen />;
  }

  // 2. Not authenticated — show login screen
  if (!identity) {
    return (
      <>
        <AnimatePresence>
          <LoginScreen onLogin={login} isLoggingIn={isLoggingIn} />
        </AnimatePresence>
        {toaster}
      </>
    );
  }

  // 3. Authenticated — get principal string for identity pill
  const principalFull = identity.getPrincipal().toString();

  // 4. Show clients homepage when no client is selected
  if (!activeClient) {
    return (
      <>
        <ClientsPage
          onSelectClient={handleSelectClient}
          onSignOut={clear}
          principal={principalFull}
        />
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
