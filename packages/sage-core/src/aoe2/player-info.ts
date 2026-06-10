import { Params, Struct } from "arquero/dist/types/table/types.js";
import { DataSet } from "../utility/data-set.js";
import { PlayerParams } from "./types/derived/playerParams.js";
import { cardinalLocation } from "./location-names.js";
import * as aq from "arquero";
import { op } from "arquero";

export function addGameInfoParams(dataSet: DataSet) {
  return dataSet.addParams(
    "gameInfo",
    (t) =>
      t.t.settings.object() as {
        mapWidth: number;
        mapHeight: number;
        mapName: string;
      },
  );
}

export function addPlayerParams<
  DS extends ReturnType<typeof addGameInfoParams>,
>(dataSet: DS) {
  return dataSet.addParams(
    "players",
    (dt) =>
      dt.t.players
        .filter(aq.escape((d: Struct) => d["sage:binId"] === 0 && d["id"] > 0))
        .select("id", "name", "color", "civilization", "startX", "startY")
        .orderby("id")
        .derive({
          colorName: (d: Struct, $: Params) => {
            return $["h"]["idToColor"][d["color"]];
          },
          civilizationName: (d: Struct, $: Params) => {
            return $["h"]["idToCiv"][d["civilization"]];
          },
          shortName: (d: Struct) => {
            const start = op.replace(d["name"], /^.*?_/, "");
            const end = op.replace(start, /_.*?$/, "");
            return end;
            // return aq.op.replace(start, /^.*_/, "");
          },
          namedLocation: aq.escape((d: Struct, $: Params) =>
            cardinalLocation(
              // TODO: don't escape
              d["startX"],
              d["startY"],
              $["dp"]["gameInfo"]["mapWidth"],
              $["dp"]["gameInfo"]["mapHeight"],
            ),
          ),
        })
        .select({
          id: "playerId",
          colorName: "color",
          shortName: "playerName",
          civilizationName: "civilizationName",
          civilization: "civilizationId",
          startX: "startX",
          startY: "startY",
          namedLocation: "namedLocation",
        })
        .objects() as Array<PlayerParams>,
  );
}

