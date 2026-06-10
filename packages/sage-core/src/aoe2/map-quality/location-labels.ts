import { MapInfo } from "./core.js";
import { cardinalLocation, cardinalTBRLtoNESW } from "../location-names.js";
import { euclidean } from "../../functions/euclidean.js";
import { Realiser } from "../../../../simplenlg-core/src/realiser/english/Realiser.js";
import { Feature } from "../../../../simplenlg-core/src/features/Feature.js";
import { InternalFeature } from "../../../../simplenlg-core/src/features/InternalFeature.js";
import { defaultEnglishContext } from "../../../../simplenlg-core/src/factory/NLGContext.js";

type MapQualityInput = {
  derivedParams: {
    mapInfo: MapInfo;
    players: Array<{
      playerName: string;
      startX: number;
      startY: number;
    }>;
  };
};

export const makeLocationList = (data: MapQualityInput) => {
  const realiser = Realiser.create(defaultEnglishContext);
  const namedList = new Array<{
    name: string;
    worldX: number;
    worldY: number;
    distance: number;
  }>();

  data.derivedParams.mapInfo.players.forEach((p, i) => {
    const playerName = data.derivedParams.players[i]!.playerName;
    const playerSNLG = realiser.context.factory.createNounPhrase(playerName);
    playerSNLG.features[Feature.POSSESSIVE] = true;

    const tcSNLG = realiser.context.factory.createNounPhrase(
      "starting Town Center",
    );
    tcSNLG.features[InternalFeature.SPECIFIER] = playerSNLG;

    const baseNLG = realiser.context.factory.createNounPhrase("base");
    baseNLG.features[InternalFeature.SPECIFIER] = playerSNLG;

    const underTCSNLG = realiser.context.factory.createPrepositionPhrase(
      "under",
      tcSNLG,
    );
    const nearTCSNLG = realiser.context.factory.createPrepositionPhrase(
      "near",
      tcSNLG,
    );
    const nearBaseNLG = realiser.context.factory.createPrepositionPhrase(
      "near",
      baseNLG,
    );

    namedList.push({
      name: realiser.realise(underTCSNLG).realisation,
      worldX: data.derivedParams.players[i]!.startX,
      worldY: data.derivedParams.players[i]!.startY,
      distance: 6,
    });

    namedList.push({
      name: realiser.realise(nearTCSNLG).realisation,
      worldX: data.derivedParams.players[i]!.startX,
      worldY: data.derivedParams.players[i]!.startY,
      distance: 12,
    });

    namedList.push({
      name: realiser.realise(nearBaseNLG).realisation,
      worldX: data.derivedParams.players[i]!.startX,
      worldY: data.derivedParams.players[i]!.startY,
      distance: 28,
    });

    p.hills.forEach((hill) => {
      const hillSNLG = realiser.context.factory.createNounPhrase("hill");
      hillSNLG.addPreModifier(hill.playerRelativePosition);
      hillSNLG.addPreModifier(hill.referenceType);
      hillSNLG.features[InternalFeature.SPECIFIER] = playerSNLG;
      namedList.push({
        name: realiser.realise(hillSNLG).realisation,
        worldX: hill.xCenter,
        worldY: hill.yCenter,
        distance: Math.sqrt(hill.ids.length) / 2,
      });
    });

    p.goldMines.forEach((mine) => {
      const mineSNLG = realiser.context.factory.createNounPhrase("Gold Mine");
      mineSNLG.addPreModifier(mine.playerRelativePosition);
      mineSNLG.addPreModifier(mine.referenceType);
      mineSNLG.features[InternalFeature.SPECIFIER] = playerSNLG;
      namedList.push({
        name: realiser.realise(mineSNLG).realisation,
        worldX: mine.xCenter,
        worldY: mine.yCenter,
        distance: 8,
      });
    });

    p.stoneMines.forEach((mine) => {
      const mineSNLG = realiser.context.factory.createNounPhrase("Stone Mine");
      mineSNLG.addPreModifier(mine.playerRelativePosition);
      mineSNLG.addPreModifier(mine.referenceType);
      mineSNLG.features[InternalFeature.SPECIFIER] = playerSNLG;
      namedList.push({
        name: realiser.realise(mineSNLG).realisation,
        worldX: mine.xCenter,
        worldY: mine.yCenter,
        distance: 8,
      });
    });
  });

  data.derivedParams.mapInfo.neutral.hills.forEach((hill) => {
    const neutralSNLG = realiser.context.factory.createNounPhrase("hill");
    neutralSNLG.addPreModifier(hill.referenceType);
    neutralSNLG.addPreModifier(hill.mapAbsolutePosition);
    namedList.push({
      name: realiser.realise(neutralSNLG).realisation,
      worldX: hill.xCenter,
      worldY: hill.yCenter,
      distance: Math.sqrt(hill.ids.length) / 2,
    });
  });

  return namedList;
};

export const getNamedLocation = (
  list: Array<{
    name: string;
    worldX: number;
    worldY: number;
    distance: number;
  }>,
  worldX: number,
  worldY: number,
) => {
  const closest = list.reduce<
    | undefined
    | {
        name: string;
        distance: number;
        worldX: number;
        worldY: number;
        measuredDistance: number;
      }
  >((prev, curr) => {
    const prevDistance = prev?.measuredDistance ?? Infinity;
    const currDistance = euclidean(
      [curr.worldX, curr.worldY],
      [worldX, worldY],
    );

    return currDistance < curr.distance && currDistance < prevDistance
      ? { ...curr, measuredDistance: currDistance }
      : prev;
  }, undefined);

  if (closest === undefined) {
    return cardinalTBRLtoNESW[cardinalLocation(worldX, worldY)] ?? "unknown";
  }

  return closest.name;
};
