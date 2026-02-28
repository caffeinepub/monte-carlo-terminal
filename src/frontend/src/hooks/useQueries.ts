import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Account, SimulationResult } from "../backend.d";
import type {
  AccountOverride,
  ExtendedSimulationConfig,
  ExtendedSimulationResult,
} from "../utils/monteCarlo";
import { runMonteCarloSimulation } from "../utils/monteCarlo";
import { useActor } from "./useActor";

// ─── Client type ───

export interface Client {
  id: string;
  name: string;
  riskProfile: "Conservative" | "Moderate" | "Aggressive" | "Custom";
  notes: string;
  targetDate: string;
  createdAt: number;
}

const CLIENTS_KEY = "mct_clients";

function loadClientsFromStorage(): Client[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Client[];
  } catch {
    return [];
  }
}

function saveClientsToStorage(clients: Client[]) {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
}

// ─── Scenario type ───

export interface Scenario {
  id: bigint;
  name: string;
  config: ExtendedSimulationConfig;
  createdAt: bigint;
}

interface StoredScenario {
  id: string;
  name: string;
  config: ExtendedSimulationConfig;
  createdAt: number;
}

// ─── LocalAccount type matches Account from backend.d.ts ───

export interface LocalAccount {
  id: bigint;
  name: string;
  accountType: string;
  amount: number;
  riskScore: bigint;
}

// ─── localStorage key helpers ───

const accountsKey = (clientId: string) => `mct_accounts_${clientId}`;
const simsKey = (clientId: string) => `mct_sims_${clientId}`;
const scenariosKey = (clientId: string) => `mct_scenarios_${clientId}`;

// ─── localStorage account helpers ───

interface StoredAccount {
  id: string;
  name: string;
  accountType: string;
  amount: number;
  riskScore: string;
}

function loadAccountsFromStorage(clientId: string): LocalAccount[] {
  try {
    const raw = localStorage.getItem(accountsKey(clientId));
    if (!raw) return [];
    const stored: StoredAccount[] = JSON.parse(raw);
    return stored.map((a) => ({
      id: BigInt(a.id),
      name: a.name,
      accountType: a.accountType,
      amount: a.amount,
      riskScore: BigInt(a.riskScore),
    }));
  } catch {
    return [];
  }
}

function saveAccountsToStorage(clientId: string, accounts: LocalAccount[]) {
  const stored: StoredAccount[] = accounts.map((a) => ({
    id: a.id.toString(),
    name: a.name,
    accountType: a.accountType,
    amount: a.amount,
    riskScore: a.riskScore.toString(),
  }));
  localStorage.setItem(accountsKey(clientId), JSON.stringify(stored));
}

// ─── localStorage simulation helpers ───

function loadSimsFromStorage(clientId: string): ExtendedSimulationResult[] {
  try {
    const raw = localStorage.getItem(simsKey(clientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Revive bigints
    return parsed.map((r: Record<string, unknown>) => reviveResult(r));
  } catch {
    return [];
  }
}

function reviveResult(r: Record<string, unknown>): ExtendedSimulationResult {
  const reviveBigInt = (v: unknown): bigint => {
    if (typeof v === "bigint") return v;
    if (typeof v === "string" || typeof v === "number") return BigInt(v);
    return BigInt(0);
  };

  const reviveConfig = (
    c: Record<string, unknown>,
  ): ExtendedSimulationConfig => ({
    numSimulations: reviveBigInt(c.numSimulations),
    timeHorizonYears: reviveBigInt(c.timeHorizonYears),
    annualContribution: Number(c.annualContribution ?? 0),
    targetValue:
      c.targetValue !== undefined ? Number(c.targetValue) : undefined,
    accountOverrides: ((c.accountOverrides as unknown[]) ?? []).map(
      (o: unknown) => {
        const ov = o as Record<string, unknown>;
        return {
          accountId: reviveBigInt(ov.accountId),
          rorOverride:
            ov.rorOverride !== undefined ? Number(ov.rorOverride) : undefined,
          annualContribution: Number(ov.annualContribution ?? 0),
          contributionGrowthRate: Number(ov.contributionGrowthRate ?? 0),
          expenseRatio: Number(ov.expenseRatio ?? 0),
          withdrawalAmount: Number(ov.withdrawalAmount ?? 0),
          withdrawalStartYear: Number(ov.withdrawalStartYear ?? 1),
        } as AccountOverride;
      },
    ),
    inflationRate: Number(c.inflationRate ?? 0),
    taxDrag: Number(c.taxDrag ?? 0),
    crashYear:
      c.crashYear !== undefined && c.crashYear !== null
        ? reviveBigInt(c.crashYear)
        : undefined,
    crashDrawdown: Number(c.crashDrawdown ?? 0),
  });

  const reviveYearStats = (arr: unknown[]) =>
    arr.map((ys: unknown) => {
      const y = ys as Record<string, unknown>;
      return {
        year: reviveBigInt(y.year),
        p10: Number(y.p10),
        p25: Number(y.p25),
        p50: Number(y.p50),
        p75: Number(y.p75),
        p90: Number(y.p90),
        mean: Number(y.mean),
      };
    });

  return {
    id: reviveBigInt(r.id),
    timestamp: reviveBigInt(r.timestamp),
    config: reviveConfig(r.config as Record<string, unknown>),
    yearlyStats: reviveYearStats((r.yearlyStats as unknown[]) ?? []),
    yearlyStatsReal: reviveYearStats((r.yearlyStatsReal as unknown[]) ?? []),
    totalInitialValue: Number(r.totalInitialValue ?? 0),
    finalP10: Number(r.finalP10 ?? 0),
    finalP25: Number(r.finalP25 ?? 0),
    finalP50: Number(r.finalP50 ?? 0),
    finalP75: Number(r.finalP75 ?? 0),
    finalP90: Number(r.finalP90 ?? 0),
    finalP10Real: Number(r.finalP10Real ?? 0),
    finalP25Real: Number(r.finalP25Real ?? 0),
    finalP50Real: Number(r.finalP50Real ?? 0),
    finalP75Real: Number(r.finalP75Real ?? 0),
    finalP90Real: Number(r.finalP90Real ?? 0),
    probabilityOfGoal: Number(r.probabilityOfGoal ?? 0),
  };
}

function saveSimsToStorage(clientId: string, sims: ExtendedSimulationResult[]) {
  const serialized = JSON.stringify(sims, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  localStorage.setItem(simsKey(clientId), serialized);
}

// ─── localStorage scenario helpers ───

function loadScenariosFromStorage(clientId: string): Scenario[] {
  try {
    const raw = localStorage.getItem(scenariosKey(clientId));
    if (!raw) return [];
    const stored: StoredScenario[] = JSON.parse(raw);
    return stored.map((s) => ({
      id: BigInt(s.id),
      name: s.name,
      config: {
        ...s.config,
        numSimulations: BigInt(s.config.numSimulations),
        timeHorizonYears: BigInt(s.config.timeHorizonYears),
        crashYear:
          s.config.crashYear !== undefined && s.config.crashYear !== null
            ? BigInt(s.config.crashYear)
            : undefined,
        accountOverrides: (s.config.accountOverrides ?? []).map(
          (o: AccountOverride) => ({
            ...o,
            accountId: BigInt(o.accountId),
          }),
        ),
      },
      createdAt: BigInt(s.createdAt),
    }));
  } catch {
    return [];
  }
}

// ─── Client Queries ───

export function useGetClients() {
  return useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => loadClientsFromStorage(),
    staleTime: 0,
  });
}

export function useAddClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<Client, "id" | "createdAt">,
    ): Promise<Client> => {
      const clients = loadClientsFromStorage();
      const newClient: Client = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        ...data,
      };
      clients.push(newClient);
      saveClientsToStorage(clients);
      return newClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Omit<Client, "id" | "createdAt">;
    }) => {
      const clients = loadClientsFromStorage();
      const idx = clients.findIndex((c) => c.id === id);
      if (idx !== -1) {
        clients[idx] = { ...clients[idx], ...data };
        saveClientsToStorage(clients);
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const clients = loadClientsFromStorage();
      const filtered = clients.filter((c) => c.id !== id);
      saveClientsToStorage(filtered);
      // Clean up all related data
      localStorage.removeItem(accountsKey(id));
      localStorage.removeItem(simsKey(id));
      localStorage.removeItem(scenariosKey(id));
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ─── Account Queries (localStorage-only, scoped by clientId) ───

export function useGetAccounts(clientId: string) {
  return useQuery<Account[]>({
    queryKey: ["accounts", clientId],
    queryFn: () => loadAccountsFromStorage(clientId) as Account[],
    staleTime: 0,
    enabled: !!clientId,
  });
}

export function useAddAccount(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      accountType,
      amount,
      riskScore,
    }: {
      name: string;
      accountType: string;
      amount: number;
      riskScore: bigint;
    }): Promise<bigint> => {
      const accounts = loadAccountsFromStorage(clientId);
      const newId = BigInt(Date.now());
      const newAccount: LocalAccount = {
        id: newId,
        name,
        accountType,
        amount,
        riskScore,
      };
      accounts.push(newAccount);
      saveAccountsToStorage(clientId, accounts);
      return newId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", clientId] });
    },
  });
}

export function useUpdateAccount(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      accountType,
      amount,
      riskScore,
    }: {
      id: bigint;
      name: string;
      accountType: string;
      amount: number;
      riskScore: bigint;
    }): Promise<boolean> => {
      const accounts = loadAccountsFromStorage(clientId);
      const idx = accounts.findIndex((a) => a.id === id);
      if (idx !== -1) {
        accounts[idx] = { id, name, accountType, amount, riskScore };
        saveAccountsToStorage(clientId, accounts);
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", clientId] });
    },
  });
}

export function useDeleteAccount(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint): Promise<boolean> => {
      const accounts = loadAccountsFromStorage(clientId);
      const filtered = accounts.filter((a) => a.id !== id);
      saveAccountsToStorage(clientId, filtered);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", clientId] });
    },
  });
}

// ─── Simulation Queries ───

export function useRunSimulation(clientId: string) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      config: ExtendedSimulationConfig,
    ): Promise<ExtendedSimulationResult> => {
      // Read accounts from localStorage
      const accounts = loadAccountsFromStorage(clientId) as Account[];

      const nowMs = BigInt(Date.now());
      const result = runMonteCarloSimulation(accounts, config, nowMs, nowMs);

      // Save to localStorage
      const sims = loadSimsFromStorage(clientId);
      sims.push(result);
      saveSimsToStorage(clientId, sims);

      // Fire-and-forget to backend if actor available
      if (actor) {
        const backendResult: SimulationResult = {
          id: result.id,
          timestamp: result.timestamp,
          config: {
            numSimulations: result.config.numSimulations,
            timeHorizonYears: result.config.timeHorizonYears,
            annualContribution: result.config.annualContribution,
            targetValue: result.config.targetValue,
          },
          yearlyStats: result.yearlyStats,
          finalP10: result.finalP10,
          finalP25: result.finalP25,
          finalP50: result.finalP50,
          finalP75: result.finalP75,
          finalP90: result.finalP90,
          probabilityOfGoal: result.probabilityOfGoal,
          totalInitialValue: result.totalInitialValue,
        };
        actor.saveSimulationResult(backendResult).catch(() => {
          // ignore backend errors
        });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["simulationHistory", clientId],
      });
    },
  });
}

export function useGetSimulationHistory(clientId: string) {
  return useQuery<ExtendedSimulationResult[]>({
    queryKey: ["simulationHistory", clientId],
    queryFn: () => loadSimsFromStorage(clientId),
    staleTime: 0,
    enabled: !!clientId,
  });
}

export function useClearSimulationHistory(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      localStorage.removeItem(simsKey(clientId));
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["simulationHistory", clientId],
      });
    },
  });
}

// ─── Scenario Queries (localStorage, scoped by clientId) ───

export function useGetScenarios(clientId: string) {
  return useQuery<Scenario[]>({
    queryKey: ["scenarios", clientId],
    queryFn: () => loadScenariosFromStorage(clientId),
    staleTime: 0,
    enabled: !!clientId,
  });
}

export function useSaveScenario(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      config,
    }: { name: string; config: ExtendedSimulationConfig }) => {
      const stored: StoredScenario[] = (() => {
        try {
          return JSON.parse(
            localStorage.getItem(scenariosKey(clientId)) ?? "[]",
          );
        } catch {
          return [];
        }
      })();
      const newScenario: StoredScenario = {
        id: Date.now().toString(),
        name,
        config: JSON.parse(
          JSON.stringify(config, (_, v) =>
            typeof v === "bigint" ? v.toString() : v,
          ),
        ),
        createdAt: Date.now(),
      };
      stored.push(newScenario);
      localStorage.setItem(scenariosKey(clientId), JSON.stringify(stored));
      return newScenario.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios", clientId] });
    },
  });
}

export function useDeleteScenario(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      const stored: StoredScenario[] = (() => {
        try {
          return JSON.parse(
            localStorage.getItem(scenariosKey(clientId)) ?? "[]",
          );
        } catch {
          return [];
        }
      })();
      const filtered = stored.filter((s) => s.id !== id.toString());
      localStorage.setItem(scenariosKey(clientId), JSON.stringify(filtered));
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios", clientId] });
    },
  });
}

export function useUpdateScenario(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      config,
    }: {
      id: bigint;
      name: string;
      config: ExtendedSimulationConfig;
    }) => {
      const stored: StoredScenario[] = (() => {
        try {
          return JSON.parse(
            localStorage.getItem(scenariosKey(clientId)) ?? "[]",
          );
        } catch {
          return [];
        }
      })();
      const idx = stored.findIndex((s) => s.id === id.toString());
      if (idx !== -1) {
        stored[idx] = {
          ...stored[idx],
          name,
          config: JSON.parse(
            JSON.stringify(config, (_, v) =>
              typeof v === "bigint" ? v.toString() : v,
            ),
          ),
        };
        localStorage.setItem(scenariosKey(clientId), JSON.stringify(stored));
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios", clientId] });
    },
  });
}
