import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Account {
    id: bigint;
    name: string;
    accountType: string;
    amount: number;
    riskScore: bigint;
}
export interface SimulationResult {
    id: bigint;
    totalInitialValue: number;
    yearlyStats: Array<YearStats>;
    probabilityOfGoal: number;
    timestamp: bigint;
    config: SimulationConfig;
    finalP10: number;
    finalP25: number;
    finalP50: number;
    finalP75: number;
    finalP90: number;
}
export interface YearStats {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
    year: bigint;
}
export interface SimulationConfig {
    timeHorizonYears: bigint;
    numSimulations: bigint;
    targetValue?: number;
    annualContribution: number;
}
export interface backendInterface {
    addAccount(name: string, accountType: string, amount: number, riskScore: bigint): Promise<bigint>;
    clearSimulationHistory(): Promise<boolean>;
    deleteAccount(id: bigint): Promise<boolean>;
    getAccounts(): Promise<Array<Account>>;
    getSimulationById(id: bigint): Promise<SimulationResult | null>;
    getSimulationHistory(): Promise<Array<SimulationResult>>;
    saveSimulationResult(result: SimulationResult): Promise<bigint>;
    updateAccount(id: bigint, name: string, accountType: string, amount: number, riskScore: bigint): Promise<boolean>;
}
