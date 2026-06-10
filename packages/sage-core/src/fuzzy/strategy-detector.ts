import type { masterToId, techToId } from "../aoe2/ids.js";

type UnitTypeName = keyof typeof masterToId;
type TechnologyName = keyof typeof techToId;

interface TrapezoidFuzzySet {
  trapezoid: [number, number, number, number];
}

interface OrFuzzySet {
  or: TrapezoidFuzzySet[];
}

type FuzzySet = TrapezoidFuzzySet | OrFuzzySet;

const atLeast = (min: number, tolerance: number = 0): TrapezoidFuzzySet => {
  const safeTolerance = Math.abs(tolerance);
  return {
    trapezoid: [
      min - safeTolerance,
      min,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ],
  };
};

const atMost = (max: number, tolerance: number = 0): TrapezoidFuzzySet => {
  const safeTolerance = Math.abs(tolerance);
  return {
    trapezoid: [
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      max,
      max + safeTolerance,
    ],
  };
};

const exactly = (target: number, tolerance: number = 0): TrapezoidFuzzySet => {
  const safeTolerance = Math.abs(tolerance);
  const min = target - safeTolerance;
  const max = target + safeTolerance;
  return {
    trapezoid: [min, min, max, max],
  };
};

const between = (min: number, max: number): TrapezoidFuzzySet => {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return {
    trapezoid: [safeMin, safeMin, safeMax, safeMax],
  };
};

const around = (optimal: number, spread: number = 2): TrapezoidFuzzySet => {
  const safeSpread = Math.abs(spread);
  return {
    trapezoid: [
      optimal - safeSpread * 2,
      optimal - safeSpread,
      optimal + safeSpread,
      optimal + safeSpread * 2,
    ],
  };
};

const exists = (): TrapezoidFuzzySet => atLeast(1);

const minimal = (): TrapezoidFuzzySet => atMost(1);

const anyOf = (...alternatives: TrapezoidFuzzySet[]): OrFuzzySet => ({
  or: alternatives,
});

type BaseCriteria = {
  unitCriteria?: UnitCriteria[];
  buildingCriteria?: UnitCriteria[]; // Building criteria is idential to unit criteria, but can be evaluated separately
  technologyCriteria?: TechnologyCriteria[];
  villagerDistribution?: VillagerDistribution;
  gatherRates?: Record<string, FuzzySet>;

  constraints?: {
    age?: FuzzySet;
    civilization?: Array<string>; // Array of civilizations that are allowed
  };
};

interface UnitCriteria {
  unitType: UnitTypeName;
  count: FuzzySet;
  position?: "forward" | "anywhere"; // Optional position criteria, "anywhere" is default
}

interface TechnologyCriteria {
  technology: TechnologyName;
  required: boolean;
}

interface VillagerDistribution {
  food?: FuzzySet;
  wood?: FuzzySet;
  gold?: FuzzySet;
  stone?: FuzzySet;
  other?: FuzzySet;
}

type StrategyDetector = {
  strategyName: string;
  timeRegion?: TrapezoidFuzzySet;
  criteria: BaseCriteria | BaseCriteria[];
};

export type BaseBreakdown = {
  unitConfidence?: number | undefined;
  unitMatches?: Record<
    string,
    {
      confidence: { confidence: number; matchedIndex?: number };
      count: number;
      position?: "forward" | "anywhere";
    }
  >;
  buildingConfidence?: number | undefined;
  buildingMatches?: Record<
    string,
    {
      confidence: { confidence: number; matchedIndex?: number };
      count: number;
      position?: "forward" | "anywhere";
    }
  >;
  technologyConfidence?: number | undefined;
  technologyMatches?: Record<
    string,
    {
      confidence: { confidence: number; matchedIndex?: number };
      state:
        | "researched"
        | "researching"
        | "queued"
        | "unavailable"
        | "available";
    }
  >;
  villagerDistributionConfidence?: number | undefined;
  villagerDistributionMatches?: Record<
    string,
    {
      confidence: { confidence: number; matchedIndex?: number };
      count: number;
    }
  >;
  constraintConfidence?: number | undefined;
  constraintMatches?: Record<
    string,
    {
      confidence: { confidence: number; matchedIndex?: number };
      count: number;
    }
  >;
};
interface StrategyMatch {
  strategyName: string;
  confidence: number;
  breakdown: {
    timeInRegion: number;
    breakdowns: BaseBreakdown[];
    matchedIndex: number | undefined;
  };
}

type VillagerDistributionState = {
  food: number;
  wood: number;
  gold: number;
  stone: number;
  other: number;
};

interface GameState {
  unitCounts: Record<string, { countTotal: number; countForward: number }>;
  buildingCounts: Record<string, { countTotal: number; countForward: number }>;
  technologies: Record<
    string,
    "researched" | "researching" | "queued" | "unavailable" | "available"
  >;
  villagerDistribution: VillagerDistributionState;
  age: number;
  playerId: number;
  timeMs: number;
}

function calculateMembership(
  value: number,
  trapezoid: [number, number, number, number],
): number {
  const [a, b, c, d] = trapezoid;

  // Avoid use of Infinity, so we ensure ensure lower and upper bounds are always resp. lower/higher than the input value
  const leftBound = a === Number.NEGATIVE_INFINITY ? value - 1 : a;
  const rightBound = d === Number.POSITIVE_INFINITY ? value + 1 : d;

  // Outside the trapezoid
  if (value < leftBound || value > rightBound) {
    return 0;
  }

  // In the flat top (including rectangular case where b === c)
  if (value >= b && value <= c) {
    return 1;
  }

  // Rising edge (only if there's a slope)
  if (value > leftBound && value < b && b > leftBound) {
    return (value - leftBound) / (b - leftBound);
  }

  // Falling edge (only if there's a slope)
  if (value > c && value < rightBound && rightBound > c) {
    return (rightBound - value) / (rightBound - c);
  }

  return 0;
}

function evaluateFuzzySet(
  value: number,
  fuzzySet: FuzzySet,
): { confidence: number; matchedIndex?: number } {
  if ("trapezoid" in fuzzySet) {
    // Single trapezoid fuzzy set
    return { confidence: calculateMembership(value, fuzzySet.trapezoid) };
  } else {
    // OR fuzzy set - return maximum membership among alternatives
    const memberships = fuzzySet.or.map((alternative) =>
      calculateMembership(value, alternative.trapezoid),
    );
    const maxConfidence = Math.max(...memberships);
    const matchedIndex = memberships.findIndex((c) => c === maxConfidence);
    return {
      confidence: maxConfidence,
      matchedIndex,
    };
  }
}

function evaluateBaseCriteria(
  gameState: GameState,
  criteria: BaseCriteria,
  combineMembership: (...memberships: number[]) => number = Math.min,
) {
  const result = {
    unitConfidence: undefined as number | undefined,
    unitMatches: {} as Record<
      string,
      {
        confidence: { confidence: number; matchedIndex?: number };
        count: number;
        position?: "forward" | "anywhere";
      }
    >,
    buildingConfidence: undefined as number | undefined,
    buildingMatches: {} as Record<
      string,
      {
        confidence: { confidence: number; matchedIndex?: number };
        count: number;
        position?: "forward" | "anywhere";
      }
    >,
    technologyConfidence: undefined as number | undefined,
    technologyMatches: {} as Record<
      string,
      {
        confidence: { confidence: number; matchedIndex?: number };
        state:
          | "researched"
          | "researching"
          | "queued"
          | "unavailable"
          | "available";
      }
    >,
    villagerDistributionConfidence: undefined as number | undefined,
    villagerDistributionMatches: {} as Record<
      string,
      {
        confidence: { confidence: number; matchedIndex?: number };
        count: number;
      }
    >,
    constraintConfidence: undefined as number | undefined,
    constraintMatches: {} as Record<
      string,
      {
        confidence: { confidence: number; matchedIndex?: number };
        count: number;
      }
    >,
  };

  if (criteria.unitCriteria) {
    const matches = criteria.unitCriteria.map((criteria) => {
      const criteriaCount =
        criteria.position === "forward"
          ? gameState.unitCounts[criteria.unitType]?.countForward || 0
          : gameState.unitCounts[criteria.unitType]?.countTotal || 0;
      return {
        unitType: criteria.unitType,
        confidence: evaluateFuzzySet(criteriaCount, criteria.count),
        count: criteriaCount,
        position: criteria.position,
      };
    });
    result.unitConfidence = combineMembership(
      ...matches.map((m) => m.confidence.confidence),
    );
    result.unitMatches = Object.fromEntries(
      matches.map((m) => [
        m.unitType,
        {
          confidence: m.confidence,
          count: m.count,
          position: m.position ?? "anywhere",
        },
      ]),
    );
  }

  if (criteria.buildingCriteria) {
    const matches = criteria.buildingCriteria.map((criteria) => {
      const criteriaCount =
        criteria.position === "forward"
          ? gameState.buildingCounts[criteria.unitType]?.countForward || 0
          : gameState.buildingCounts[criteria.unitType]?.countTotal || 0;
      return {
        buildingType: criteria.unitType,
        confidence: evaluateFuzzySet(criteriaCount, criteria.count),
        count: criteriaCount,
        position: criteria.position,
      };
    });
    result.buildingConfidence = combineMembership(
      ...matches.map((m) => m.confidence.confidence),
    );
    result.buildingMatches = Object.fromEntries(
      matches.map((m) => [
        m.buildingType,
        {
          confidence: m.confidence,
          count: m.count,
          position: m.position ?? "anywhere",
        },
      ]),
    );
  }

  if (criteria.technologyCriteria) {
    const breakdownEntries: [
      string,
      {
        confidence: { confidence: number };
        state: (typeof gameState.technologies)[keyof typeof gameState.technologies];
      },
    ][] = [];
    const matches: number[] = [];

    for (const techCriteria of criteria.technologyCriteria) {
      const state =
        gameState.technologies[techCriteria.technology] ?? "unavailable";
      const confidence =
        state === "researched" ? 1 : state === "researching" ? 0.5 : 0;

      breakdownEntries.push([
        techCriteria.technology,
        { confidence: { confidence }, state },
      ]);

      if (techCriteria.required) {
        matches.push(confidence);
      }
    }

    result.technologyConfidence = combineMembership(...matches);
    result.technologyMatches = Object.fromEntries(breakdownEntries);
  }

  if (criteria.villagerDistribution) {
    const breakdownEntries: [
      string,
      {
        confidence: { confidence: number; matchedIndex?: number };
        count: number;
      },
    ][] = [];
    const matches: number[] = [];

    for (const [resource, fuzzySet] of Object.entries(
      criteria.villagerDistribution as Record<string, FuzzySet>,
    )) {
      const count: number =
        gameState.villagerDistribution[
          resource as keyof VillagerDistributionState
        ] || 0;
      const confidence: { confidence: number; matchedIndex?: number } =
        evaluateFuzzySet(count, fuzzySet);
      breakdownEntries.push([resource, { confidence, count }]);
      matches.push(confidence.confidence);
    }

    result.villagerDistributionConfidence = combineMembership(...matches);
    result.villagerDistributionMatches = Object.fromEntries(breakdownEntries);
  }

  if (criteria.constraints) {
    if (criteria.constraints.age) {
      const ageMatch = evaluateFuzzySet(
        gameState.age,
        criteria.constraints.age,
      );
      result.constraintConfidence = ageMatch.confidence;
    }
  }
  return result;
}

const defaultEvaluateStrategyParams = {
  combineMembership: Math.min, // Logic AND
  overallConfidence: Math.min, // Logic AND
  timeConfidenceMultiplier: (
    timeInput: number,
    confidence: number, // Hard confidence
  ) => (timeInput < 1 ? 0 : confidence),
};

function evaluateStrategy(
  gameState: GameState,
  detector: StrategyDetector,
  params: {
    overallConfidence?: (...values: number[]) => number;
    timeConfidenceMultiplier?: (
      timeInput: number,
      confidence: number,
    ) => number;
  } = defaultEvaluateStrategyParams,
): StrategyMatch {
  // Check if current time is within the strategy's time region
  const settings = { ...defaultEvaluateStrategyParams, ...params };
  const timeMinutes = gameState.timeMs / 60_000;
  const timeInRegion = detector.timeRegion
    ? evaluateFuzzySet(timeMinutes, detector.timeRegion)
    : { confidence: 1 };

  const criteria = Array.isArray(detector.criteria)
    ? detector.criteria
    : [detector.criteria];

  const timeConfidence = timeInRegion.confidence;

  const evaluatedAll = criteria.map((c) => {
    const evalutatedCriteria = evaluateBaseCriteria(
      gameState,
      c,
      settings.combineMembership,
    );
    const overallConfidence = settings.overallConfidence(
      ...[
        evalutatedCriteria.unitConfidence,
        evalutatedCriteria.buildingConfidence,
        evalutatedCriteria.technologyConfidence,
        evalutatedCriteria.villagerDistributionConfidence,
        evalutatedCriteria.constraintConfidence,
      ].filter((v) => v !== undefined && v !== null),
    );

    return {
      baseConfidence: overallConfidence,
      breakdown: evalutatedCriteria,
      confidence: settings.timeConfidenceMultiplier(
        timeConfidence,
        overallConfidence,
      ),
    };
  });

  const bestMatch = evaluatedAll.reduce(
    (best, current, index) => {
      if (current.confidence > best.confidence) {
        return { ...current, matchedIndex: index };
      }
      return best;
    },
    { confidence: 0, matchedIndex: undefined as number | undefined },
  );

  return {
    strategyName: detector.strategyName,
    confidence: bestMatch.confidence,
    breakdown: {
      timeInRegion: timeConfidence,
      breakdowns: evaluatedAll.map((match) => ({
        ...match.breakdown,
      })),
      matchedIndex: bestMatch.matchedIndex,
    },
  };
}

function detectStrategies(
  gameState: GameState,
  detectors: StrategyDetector[],
  threshold: number = 0.3,
): StrategyMatch[] {
  return detectors
    .map((detector) => evaluateStrategy(gameState, detector))
    .filter((match) => match.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending
}

export {
  TrapezoidFuzzySet,
  OrFuzzySet,
  BaseCriteria,
  GameState,
  StrategyDetector,
  StrategyMatch,
  atLeast,
  atMost,
  exactly,
  between,
  around,
  exists,
  minimal,
  anyOf,
  calculateMembership,
  evaluateFuzzySet,
  evaluateBaseCriteria,
  evaluateStrategy,
  detectStrategies,
};

