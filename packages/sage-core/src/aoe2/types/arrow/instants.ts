// Note: In the game's output (and code) we still use "Event" instead of "Instant" (since thats what is used internally).
// Since we use the same shape for all Instants we have somewhat generic names for the fields, but they should stil lbe clear. See comments below for more details.

export type DSInstant =
  | DSDamageInstant
  | DSDeathInstant
  | DSMarketTransactionInstant
  | DSTechStatusInstant
  | DSMonkConversionInstant
  | DSGarrisonInstant
  | DSUnitCreatedInstant
  | DSChatInstant
  | DSLifeCycleInstant
  | DSMinuteTickInstant;

export type EnhancedStudySystemInput =
  | DSDamageInstant
  | DSDeathInstant
  | DSLifeCycleInstant
  | DSMinuteTickInstant;

export type DSBaseInstant = {
  type:
    | "damage"
    | "death"
    | "marketTransaction"
    | "techStatus"
    | "monkConversion"
    | "garrison"
    | "unitCreated"
    | "chat"
    | "lifeCycle"
    | "minuteTick"
    | "finalTick"; // used for the last tick of the game to ensure closing statement
  worldTime: number;
};

export type DSDamageInstant = DSBaseInstant & {
  type: "damage";
  worldX: number;
  worldY: number;
  worldZ: number;
  subjectEntity: number; // Unit or Building that caused the damage
  subjectPlayerId: number;
  objectEntity: number; // Unit or Building that received the damage
  objectPlayerId: number;
};

export type DSDeathInstant = DSBaseInstant & {
  type: "death";
  worldX: number;
  worldY: number;
  worldZ: number;
  subjectEntity: number; // Unit or Building that caused the death
  subjectPlayerId: number;
  objectEntity: number; // Unit or Building that died
  objectPlayerId: number;
};

export type DSMarketTransactionInstant = DSBaseInstant & {
  type: "marketTransaction";
  subjectPlayerId: number;
  resourceType: number;
  resourceAmount: number;
  goldAmount: number;
};

export type DSTechStatusInstant = DSBaseInstant & {
  type: "techStatus";
  tag: "researching" | "completed" | "canceled" | "forceCanceled";
  subjectEntity: number;
  subjectPlayerId: number;
  techId: number;
  worldX: number;
  worldY: number;
  worldZ: number;
};

export type DSMonkConversionInstant = DSBaseInstant & {
  type: "monkConversion";
  subjectEntity: number; // Monk that converted the unit
  subjectPlayerId: number;
  objectEntity: number; // Converted Unit or Building
  objectPlayerId: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  heresyActivated: boolean;
};

export type DSUnitCreatedInstant = DSBaseInstant & {
  // This is possibly redundant with lifeCycle, but not supported in the current data set which relies on an older version of the game
  type: "unitCreated";
  subjectEntity: number; // Building that created the unit
  subjectPlayerId: number;
  objectEntity: number; // Unit created
  objectPlayerId: number;
  worldX: number;
  worldY: number;
  worldZ: number;
};

export type DSChatInstant = DSBaseInstant & {
  // Note: Currently disabled and not present in the data set (it would also polluted with localized age up notifications)
  type: "chat";
  subjectPlayerId: number; // Player that sent the chat message
  objectPlayerId: number; // Player that received the chat message
  message: string; // Chat message content
};

export type DSLifeCycleInstant = DSBaseInstant & {
  type: "lifeCycle";
  tag: "created" | "constructed" | "underConstruction" | "dead"; // TODO (later): use more consistent tag names
  subjectEntity: number; // Unit or Building that is created, destroyed or converted
  subjectPlayerId: number;
  worldX: number;
  worldY: number;
  worldZ: number;
};

export type DSGarrisonInstant = DSBaseInstant & {
  type: "garrison";
  tag: "garrison" | "ungarrison"; // TODO (later): using garrisoned and ungarrisoned would be more consistent
  subjectEntity: number; // Unit garrisoned into or ungarrisoned from a building
  subjectPlayerId: number;
  objectEntity: number; // Building garrisoned into or ungarrisoned from
  objectPlayerId: number;
  worldX: number;
  worldY: number;
  worldZ: number;
};

export type DSMinuteTickInstant = DSBaseInstant & {
  type: "minuteTick" | "finalTick"; // "finalTick" is used for the last tick of the game
  minute: number; // Game minute (worldTime / 60000)
};

