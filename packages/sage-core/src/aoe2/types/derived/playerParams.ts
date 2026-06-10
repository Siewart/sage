export type PlayerParams = {
  playerId: number;
  playerName: string;
  color: string;
  civilizationName: string;
  civilizationId: number;
  startX: number;
  startY: number;
  namedLocation: string;
};

export type PlayerParamsWithResources = PlayerParams & {
  resources: {
    food: number;
    wood: number;
    gold: number;
    stone: number;
  };
};
