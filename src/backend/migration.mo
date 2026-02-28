module {
  type OldActor = {
    nextAccountId : Nat;
    nextSimulationId : Nat;
  };

  type Account = {
    id : Nat;
    name : Text;
    accountType : Text;
    amount : Float;
    riskScore : Nat;
  };

  type SimulationConfig = {
    numSimulations : Nat;
    timeHorizonYears : Nat;
    targetValue : ?Float;
    annualContribution : Float;
  };

  type YearStats = {
    year : Nat;
    p10 : Float;
    p25 : Float;
    p50 : Float;
    p75 : Float;
    p90 : Float;
    mean : Float;
  };

  type SimulationResult = {
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

  type NewActor = {
    nextAccountId : Nat;
    nextSimulationId : Nat;
    accountEntries : [(Nat, Account)];
    simulationEntries : [(Nat, SimulationResult)];
  };

  public func run(old : OldActor) : NewActor {
    {
      old with
      accountEntries = [];
      simulationEntries = [];
    };
  };
};
