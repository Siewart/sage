import { ParamOf, TableOf } from "../utility/data-set.js";

export type LocationNames = ParamOf<
  "locationNames",
  {
    locationName: (x: number, y: number) => string;
    playerRelative: (x: number, y: number, playerId: number) => string;
    cardinalDirection: (x: number, y: number) => string;
  }
>;

export type MapQuality = TableOf<"mapQuality">;

// Note: I needed to change values to lower case since the LLM kept them capitalized at times after the realisation stage
// It could be interesting to add per data point prompt notes

type CardinalLocationTBRL =
  | "top"
  | "bottom"
  | "right"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left"
  | "center";

type CardinalLocationNESW =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west"
  | "center";

export const cardinalTBRLtoNESW: Record<
  CardinalLocationTBRL,
  CardinalLocationNESW
> = {
  top: "north",
  bottom: "south",
  right: "east",
  left: "west",
  "top-left": "north-west",
  "top-right": "north-east",
  "bottom-right": "south-east",
  "bottom-left": "south-west",
  center: "center",
};

//                 x1 y0
//                ⎽⎼⎻⎺⎻⎼⎽
//           ⎽⎼⎻⎺         ⎺⎻⎼⎽
//   x0 ⎽⎼⎻⎺                   ⎺⎻⎼⎽  x1
//   y0 ⎺⎻⎼⎽                   ⎽⎼⎻⎺  y1
//           ⎺⎻⎼⎽         ⎽⎼⎻⎺
//                ⎺⎻⎼⎽⎼⎻⎺
//                y1  x0

export function cardinalLocation( //
  x: number,
  y: number,
  width: number = 120,
  height: number = 120,
): CardinalLocationTBRL {
  const xNormalized = (x / width) * 2 - 1; // Normalize to [-1, 1]
  const yNormalized = (y / height) * 2 - 1; // Normalize to [-1, 1]
  if (xNormalized < 0.33) {
    if (yNormalized < 0.33) {
      return "left";
    } else if (yNormalized > 0.66) {
      return "bottom";
    } else {
      return "bottom-left";
    }
  } else if (xNormalized > 0.66) {
    if (yNormalized < 0.33) {
      return "top";
    } else if (yNormalized > 0.66) {
      return "right";
    } else {
      return "top-right";
    }
  } else {
    if (yNormalized < 0.33) {
      return "top-left";
    } else if (yNormalized > 0.66) {
      return "bottom-right";
    } else {
      return "center";
    }
  }
}
