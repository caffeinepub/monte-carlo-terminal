import Float "mo:core/Float";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Order "mo:core/Order";



actor {
  // Types
  public type Account = {
    id : Nat;
    name : Text;
    accountType : Text;
    amount : Float;
    riskScore : Nat;
  };

  public type SimulationConfig = {
    numSimulations : Nat;
    timeHorizonYears : Nat;
    targetValue : ?Float;
    annualContribution : Float;
  };

  public type YearStats = {
    year : Nat;
    p10 : Float;
    p25 : Float;
    p50 : Float;
    p75 : Float;
    p90 : Float;
    mean : Float;
  };

  public type SimulationResult = {
    id : Nat;
    timestamp : Int;
    config : SimulationConfig;
    yearlyStats : [YearStats];
    finalP10 : Float;
    finalP25 : Float;
    finalP50 : Float;
    finalP75 : Float;
    finalP90 : Float;
    probabilityOfGoal : Float;
    totalInitialValue : Float;
  };

  // Stable storage
  var nextAccountId = 1;
  var nextSimulationId = 1;
  var accountEntries : [(Nat, Account)] = [];
  var simulationEntries : [(Nat, SimulationResult)] = [];

  // Runtime maps (cleared on upgrade)
  let accounts = Map.empty<Nat, Account>();
  let simulations = Map.empty<Nat, SimulationResult>();

  // Helper comparison for YearStats
  module YearStats {
    public func compareByYear(stats1 : YearStats, stats2 : YearStats) : Order.Order {
      Nat.compare(stats1.year, stats2.year);
    };
  };

  func cappedSimulations(numSimulations : Nat) : Nat {
    if (numSimulations > 50000) { return 50000 };
    if (numSimulations < 10) { return 10 };
    numSimulations;
  };

  // Account Management (public, not shared)
  public func addAccount(name : Text, accountType : Text, amount : Float, riskScore : Nat) : async Nat {
    if (riskScore < 1 or riskScore > 10) {
      Runtime.trap("Risk score must be between 1 and 10");
    };
    let id = nextAccountId;
    nextAccountId += 1;
    let account : Account = {
      id;
      name;
      accountType;
      amount;
      riskScore;
    };
    accounts.add(id, account);
    id;
  };

  public func updateAccount(id : Nat, name : Text, accountType : Text, amount : Float, riskScore : Nat) : async Bool {
    if (riskScore < 1 or riskScore > 10) {
      Runtime.trap("Risk score must be between 1 and 10");
    };

    switch (accounts.get(id)) {
      case (null) { false };
      case (?_) {
        let account : Account = {
          id;
          name;
          accountType;
          amount;
          riskScore;
        };
        accounts.add(id, account);
        true;
      };
    };
  };

  public func deleteAccount(id : Nat) : async Bool {
    switch (accounts.get(id)) {
      case (null) { false };
      case (_) {
        accounts.remove(id);
        true;
      };
    };
  };

  public query ({ caller }) func getAccounts() : async [Account] {
    accounts.values().toArray();
  };

  // Simulation History Management (public, not shared)
  public func saveSimulationResult(result : SimulationResult) : async Nat {
    let finalConfig = {
      numSimulations = cappedSimulations(result.config.numSimulations);
      timeHorizonYears = if (result.config.timeHorizonYears > 50) { 50 } else if (result.config.timeHorizonYears < 1) {
        1;
      } else { result.config.timeHorizonYears };
      targetValue = result.config.targetValue;
      annualContribution = if (result.config.annualContribution < 0) { 0.0 } else {
        result.config.annualContribution;
      };
    };

    let storedResult : SimulationResult = {
      result with
      id = nextSimulationId;
      timestamp = Time.now();
      config = finalConfig;
    };

    simulations.add(nextSimulationId, storedResult);
    nextSimulationId += 1;
    nextSimulationId - 1;
  };

  public query ({ caller }) func getSimulationHistory() : async [SimulationResult] {
    let resultList = List.empty<SimulationResult>();
    for (sim in simulations.values()) {
      resultList.add(sim);
    };
    resultList.toArray().reverse();
  };

  public query ({ caller }) func getSimulationById(id : Nat) : async ?SimulationResult {
    simulations.get(id);
  };

  public func clearSimulationHistory() : async Bool {
    simulations.clear();
    true;
  };
};

