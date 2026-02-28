import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Account, SimulationConfig, SimulationResult } from "../backend.d";
import { runMonteCarloSimulation } from "../utils/monteCarlo";
import { useActor } from "./useActor";

// ─── Account Queries ───

export function useGetAccounts() {
  const { actor, isFetching } = useActor();
  return useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAccounts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddAccount() {
  const { actor } = useActor();
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
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.addAccount(name, accountType, amount, riskScore);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const { actor } = useActor();
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
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateAccount(id, name, accountType, amount, riskScore);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteAccount() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteAccount(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

// ─── Simulation Queries ───

export function useRunSimulation() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: SimulationConfig): Promise<SimulationResult> => {
      if (!actor) throw new Error("Actor not available");

      // Fetch real account data
      const accounts = (await actor.getAccounts()) as Account[];

      // Run Monte Carlo in the browser using real account data
      const result = runMonteCarloSimulation(
        accounts,
        config,
        BigInt(0),
        BigInt(0),
      );

      // Persist full result to backend (backend assigns real id + timestamp)
      const assignedId = await actor.saveSimulationResult(result);

      return { ...result, id: assignedId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulationHistory"] });
    },
  });
}

export function useGetSimulationHistory() {
  const { actor, isFetching } = useActor();
  return useQuery<SimulationResult[]>({
    queryKey: ["simulationHistory"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSimulationHistory();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useClearSimulationHistory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.clearSimulationHistory();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulationHistory"] });
    },
  });
}
