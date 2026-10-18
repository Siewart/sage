import { DataSet } from "../utility/data-set.js";
import { PlayerParams } from "./types/derived/playerParams.js";
import { cardinalLocation } from "./location-names.js";
import { idToCiv, idToColor } from "./ids.js";

export function addGameInfoParams(dataSet: DataSet) {
  return dataSet.addParams("gameInfo", (t) => t.query.settings());
}

/**
 * Trim a player's in-game tag down to the name itself: clan prefixes and
 * suffixes are separated by underscores, e.g. `[aM]_TheMbL_` -> `TheMbL`.
 */
function shortName(name: string): string {
  return name.replace(/^.*?_/, "").replace(/_.*?$/, "");
}

export function addPlayerParams<
  DS extends ReturnType<typeof addGameInfoParams>,
>(dataSet: DS) {
  return dataSet.addParams("players", (dt) => {
    const { mapWidth, mapHeight } = dt.derivedParams.gameInfo;
    return dt.query
      .players({
        bin: 0,
        minId: 0,
        columns: ["id", "name", "color", "civilization", "startX", "startY"],
      })
      .map((row) => ({
        playerId: row["id"] as number,
        color: idToColor[row["color"] as keyof typeof idToColor],
        playerName: shortName(row["name"] as string),
        civilizationName: idToCiv[row["civilization"] as keyof typeof idToCiv],
        civilizationId: row["civilization"] as number,
        startX: row["startX"] as number,
        startY: row["startY"] as number,
        namedLocation: cardinalLocation(
          row["startX"] as number,
          row["startY"] as number,
          mapWidth,
          mapHeight,
        ),
      }))
      .sort((a, b) => a.playerId - b.playerId) as Array<PlayerParams>;
  });
}
