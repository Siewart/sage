import {
  StrategyDetector,
  atLeast,
  atMost,
  exactly,
  between,
} from "./strategy-detector.js";

// Strategies are LLM generated & manually reviewed by a human.

// Example: Drush strategy
const drushDetector: StrategyDetector = {
  strategyName: "Drush",
  timeRegion: between(7, 14),
  criteria: {
    unitCriteria: [
      {
        unitType: "Militia",
        count: atLeast(2),
      },
    ],
    constraints: {
      age: between(0, 1), // Dark Age to early Feudal
    },
  },
};

// Multiple strategy examples
export const strategyDetectors: StrategyDetector[] = [
  // Drush
  drushDetector,

  // Archers
  {
    strategyName: "Archers",
    timeRegion: between(8, 18),
    criteria: {
      unitCriteria: [
        {
          unitType: "Archer",
          count: atLeast(3),
        },
      ],
      buildingCriteria: [
        {
          unitType: "Archery Range",
          count: atLeast(1),
        },
      ],
      constraints: {
        age: exactly(1), // Feudal Age
      },
    },
  },

  // Scouts
  {
    strategyName: "Scouts",
    timeRegion: between(7, 16),
    criteria: {
      unitCriteria: [
        {
          unitType: "Scout Cavalry",
          count: atLeast(2),
        },
      ],
      buildingCriteria: [
        {
          unitType: "Stable",
          count: atLeast(1),
        },
      ],
      constraints: {
        age: atLeast(1),
      },
    },
  },

  // Tower Rush (Trush)
  {
    strategyName: "Tower Rush",
    timeRegion: between(6, 11),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: { trapezoid: [18, 20, 25, 28] },
        },
      ],
      villagerDistribution: {
        stone: atLeast(2), // High stone for towers
      },
      buildingCriteria: [
        {
          unitType: "Watch Tower",
          count: atLeast(1),
          position: "forward",
        },
      ],
      technologyCriteria: [
        {
          technology: "Loom",
          required: true,
        },
      ],
      constraints: {
        age: between(0, 1), // Dark to Feudal Age
      },
    },
  },

  // Man-at-Arms rush (different from Tati - more focused on the upgrade)
  {
    strategyName: "Man-at-Arms Rush",
    timeRegion: between(9, 16),
    criteria: {
      unitCriteria: [
        {
          unitType: "Man-at-Arms",
          count: atLeast(2),
        },
      ],
      buildingCriteria: [
        {
          unitType: "Barracks",
          count: atLeast(1), // At least 1 barracks
        },
      ],
      technologyCriteria: [
        {
          technology: "Man-at-Arms",
          required: true,
        },
      ],
      constraints: {
        age: { trapezoid: [1, 1, 2, 2] }, // Feudal Age
      },
    },
  },

  // Fast Castle, TODO: Villagers need to be on gold
  {
    strategyName: "Fast Castle",
    timeRegion: between(7, 16),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: { trapezoid: [28, 30, 35, 40] },
        },
      ],
      constraints: {
        age: { trapezoid: [2, 2, 2, 3] }, // Castle Age
      },
    },
  },
];

// Mid-game and economic strategies (not openings)
export const followupStrategies: StrategyDetector[] = [
  // Knights (Castle Age cavalry focus)
  {
    strategyName: "Knights",
    timeRegion: between(15, 35),
    criteria: {
      unitCriteria: [
        {
          unitType: "Knight",
          count: atLeast(2),
        },
      ],
      buildingCriteria: [
        {
          unitType: "Stable",
          count: atLeast(1),
        },
      ],
      technologyCriteria: [
        {
          technology: "Bloodlines",
          required: false,
        },
        {
          technology: "Scale Barding Armor",
          required: false,
        },
        {
          technology: "Chain Barding Armor",
          required: false,
        },
        {
          technology: "Forging",
          required: false,
        },
        {
          technology: "Iron Casting",
          required: false,
        },
      ],
      constraints: {
        age: { trapezoid: [2, 2, 3, 3] }, // Castle Age
      },
    },
  },

  // Crossbows (Feudal/Castle archer focus)
  {
    strategyName: "Crossbows",
    timeRegion: between(12, 25),
    criteria: {
      unitCriteria: [
        {
          unitType: "Crossbowman",
          count: atLeast(5), // 5+ crossbows, no upper limit
        },
      ],
      buildingCriteria: [
        {
          unitType: "Archery Range",
          count: { trapezoid: [2, 3, 4, 6] },
        },
      ],
      technologyCriteria: [
        {
          technology: "Crossbowman",
          required: true,
        },
      ],
      constraints: {
        age: { trapezoid: [1, 2, 2, 3] }, // Late Feudal to Castle Age
      },
    },
  },

  // Booming (Economic focus)
  {
    strategyName: "Booming",
    timeRegion: between(10, 25),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: atLeast(40), // 40+ villagers, focus on economy
        },
      ],
      buildingCriteria: [
        {
          unitType: "Town Center",
          count: atLeast(3), // Multiple TCs
        },
        {
          unitType: "Farm",
          count: atLeast(25),
        },
      ],
      constraints: {
        age: { trapezoid: [2, 2, 3, 3] }, // Castle Age focus
      },
    },
  },

  // Siege Push (Castle Age siege focus)
  {
    strategyName: "Siege Push",
    timeRegion: between(18, 35),
    criteria: {
      unitCriteria: [
        {
          unitType: "Mangonel",
          count: atLeast(1), // 1+ mangonel, focus on siege
        },
        {
          unitType: "Crossbowman",
          count: atLeast(8), // 8+ supporting archers
        },
      ],
      buildingCriteria: [
        {
          unitType: "Siege Workshop",
          count: { trapezoid: [1, 1, 2, 3] },
        },
      ],
      constraints: {
        age: { trapezoid: [2, 2, 2, 3] }, // Castle Age
      },
    },
  },

  // Monks (Castle Age monk rush/support)
  {
    strategyName: "Monks",
    timeRegion: between(16, 30),
    criteria: {
      unitCriteria: [
        {
          unitType: "Monk",
          count: atLeast(3), // 3+ monks, no upper limit
        },
      ],
      buildingCriteria: [
        {
          unitType: "Monastery",
          count: { trapezoid: [1, 1, 2, 3] },
        },
      ],
      technologyCriteria: [
        {
          technology: "Redemption",
          required: false, // Optional tech
        },
        {
          technology: "Sanctity",
          required: false, // Optional tech
        },
      ],
      constraints: {
        age: { trapezoid: [2, 2, 2, 3] }, // Castle Age
      },
    },
  },

  // Castle Drop (Aggressive castle placement)
  {
    strategyName: "Castle Drop",
    timeRegion: between(16, 25),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: { trapezoid: [25, 30, 40, 45] },
        },
      ],
      buildingCriteria: [
        {
          unitType: "Castle",
          count: { trapezoid: [1, 1, 2, 3] }, // Forward castle(s)
          position: "forward",
        },
      ],
      villagerDistribution: {
        stone: atLeast(2), // 2+ stone per minute (active stone economy)
      },
      constraints: {
        age: { trapezoid: [2, 2, 2, 3] }, // Castle Age
        // Focus on gather rate rather than total resources
      },
    },
  },

  // Tower Drop (Aggressive tower placement)
  {
    strategyName: "Tower Drop",
    timeRegion: between(6, 12),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: { trapezoid: [18, 20, 25, 28] },
          position: "forward",
        },
      ],
      villagerDistribution: {
        stone: atLeast(3), // High stone for towers
      },
      buildingCriteria: [
        {
          unitType: "Watch Tower",
          count: atLeast(2), // Forward tower(s)
          position: "forward",
        },
      ],
    },
  },
];

// Strategy predictors based on villager distribution patterns
export const villagerDistributionPredictors: StrategyDetector[] = [
  // Fast Castle Predictor (high food focus for faster aging)
  {
    strategyName: "Fast Castle Intent",
    timeRegion: between(8, 16),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: { trapezoid: [20, 25, 35, 40] },
        },
      ],
      villagerDistribution: {
        food: atLeast(8), // Heavy food focus
        wood: atLeast(8), // Moderate wood
        gold: atLeast(1), // Some gold for aging
        stone: atMost(2), // Minimal stone
      },
      constraints: {
        age: atMost(0.5), // Feudal transitioning to Castle
      },
    },
  },

  // Archer Focus Predictor (gold heavy for archer production)
  {
    strategyName: "Archer Focus Intent",
    timeRegion: between(8, 20),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: { trapezoid: [17, 25, 35, 40] },
        },
      ],
      villagerDistribution: {
        food: { trapezoid: [8, 10, 15, 18] }, // Moderate food
        wood: { trapezoid: [8, 10, 15, 18] }, // Wood for ranges and farms
        gold: { trapezoid: [6, 8, 12, 15] }, // High gold for archers
        stone: { trapezoid: [0, 0, 2, 3] }, // Minimal stone
      },
      constraints: {
        age: { trapezoid: [1, 1, 2, 2] }, // Feudal to Castle
      },
    },
  },

  // Knight Focus Predictor (food and gold heavy)
  {
    strategyName: "Knight Focus Intent",
    timeRegion: between(15, 30),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: { trapezoid: [25, 30, 45, 55] },
        },
      ],
      villagerDistribution: {
        food: { trapezoid: [12, 15, 25, 30] }, // High food for knights
        wood: { trapezoid: [8, 10, 15, 18] }, // Moderate wood
        gold: { trapezoid: [8, 10, 15, 20] }, // High gold for knights
        stone: { trapezoid: [0, 0, 3, 5] }, // Minimal stone
      },
      constraints: {
        age: { trapezoid: [2, 2, 3, 3] }, // Castle Age
      },
    },
  },

  // Tower Rush Predictor (stone focus)
  {
    strategyName: "Tower Rush Intent",
    timeRegion: between(6, 12),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: { trapezoid: [18, 20, 25, 28] },
        },
      ],
      villagerDistribution: {
        stone: atLeast(2), // High stone for towers
      },
      constraints: {
        age: atMost(0.5), // Dark to Feudal
      },
    },
  },

  // Boom Predictor (balanced high economy)
  {
    strategyName: "Boom Intent",
    timeRegion: between(12, 25),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: atLeast(24),
        },
      ],
      constraints: {
        age: atMost(0.5),
      },
    },
  },

  // Scout Rush Predictor (food heavy for cavalry)
  {
    strategyName: "Scout Rush Intent",
    timeRegion: between(8, 16),
    criteria: {
      unitCriteria: [
        {
          unitType: "Villager",
          count: atMost(21),
        },
      ],
      villagerDistribution: {
        food: atLeast(12), // High food for scouts
        wood: atLeast(2), // Moderate wood
        gold: atMost(1), // Low gold (scouts are cheap)
        stone: atMost(0, 1), // Minimal stone
      },
      constraints: {
        age: atMost(1.5), // Feudal Age
      },
    },
  },
];
