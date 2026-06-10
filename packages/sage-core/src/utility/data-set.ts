/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs";
import * as path from "path";
import * as aq from "arquero";
import { z } from "zod";
import {
  classToId,
  idToCiv,
  idToColor,
  masterGroups,
  terrainGroups,
  masterToId,
  typeToId,
} from "../aoe2/ids.js";

export type TableOf<
  T extends string,
  Z extends z.AnyZodTuple = z.AnyZodTuple,
> = {
  [K in T]: Z;
};

export type TablesOf<P extends readonly TableOf<string, z.AnyZodTuple>[]> =
  P extends readonly [ParamOf<infer T, infer V>, ...infer Rest]
    ? {
        [K in T]: V;
      } & TablesOf<
        Rest extends readonly TableOf<string, z.AnyZodTuple>[] ? Rest : never
      >
    : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      {};

export type ParamsOf<P extends readonly ParamOf<string, unknown>[]> =
  P extends readonly [ParamOf<infer T, infer V>, ...infer Rest]
    ? {
        [K in T]: V;
      } & ParamsOf<
        Rest extends readonly ParamOf<string, unknown>[] ? Rest : never
      >
    : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      {};

export type ParamOf<T extends string, V> = {
  [K in T]: V;
};

type Strings = TableOf<"strings">;
type Events = TableOf<"events">;
type Map = TableOf<"map">;
type Settings = TableOf<"settings">;

type Players = TableOf<"players">;
type ResearchStates = TableOf<"researchStates">;
type Entities = TableOf<"entities">;
type Masters = TableOf<"masters">;
type World = TableOf<"world">;

type TablesFrom<x extends TablesOf<any>> = {
  [K in keyof x]: aq.ColumnTable;
};

export type DefaultAoE2Tables = TablesOf<[Strings, Events, Map, Settings]>;
export type DefaultAoE2BinnedTables = TablesOf<
  [Players, ResearchStates, Entities, Masters, World]
>;
export class DataSet<
  T extends TablesOf<any> = DefaultAoE2Tables, // TODO: These are partially hardcoded, but should be fully generic.
  B extends TablesOf<any> = DefaultAoE2BinnedTables,
  P extends ParamsOf<any> = ParamsOf<[]>, //{ [key: string]: unknown } = Record<string, unknown>,
  D extends TablesOf<any> = TablesOf<[]>, //{ [key: string]: aq.ColumnTable } = Record<string, aq.ColumnTable>,
> {
  readonly name: string;

  readonly derivedParams: P; // Parameters that can be used in the tables, e.g. for derived columns.
  readonly derivedTables: TablesFrom<D>; // Tables that are derived from the base tables, e.g. for custom queries.

  readonly baseTables: TablesFrom<T & B>;

  get t() {
    return this.baseTables;
  }

  get d() {
    return this.derivedTables;
  }

  readonly descriptor: z.infer<typeof schema>;

  constructor(
    descriptor: string,
    derivedParams: P = {} as P,
    derivedTables: TablesFrom<D> = {} as TablesFrom<D>,
  ) {
    if (!fs.existsSync(descriptor)) {
      throw new Error(`File not found: ${path.resolve(descriptor)}`);
    }
    this.derivedParams = derivedParams as P;
    this.derivedTables = derivedTables as TablesFrom<D>;

    this.descriptor = this.parseDescriptor(descriptor);
    this.name = this.descriptor.name;

    this.baseTables = {} as typeof this.baseTables;
    const initialParams = {
      h: {
        masterToId,
        masterGroups,
        classToId,
        idToColor,
        idToCiv,
        typeToId,
        terrainGroups,
        // timeToBin: this.timeToWindow.bind(this),
        // binToTimes: this.binToTimes.bind(this),
      } as const,
      dp: this.derivedParams,
    };
    for (const dict of this.descriptor.dictionaries) {
      if (!fs.existsSync(relativeFromDescriptor(descriptor, dict.path))) {
        throw new Error(
          `Dictionary file not found: ${relativeFromDescriptor(descriptor, dict.path)}`,
        );
      }
      // const table = aq.loadArrow(dict.path); // This may cause debug issues in Jest, where it seems to load an alternative FS.
      const stream = fs.readFileSync(
        relativeFromDescriptor(descriptor, dict.path),
      );
      const table = aq.fromArrow(stream);
      table.params(initialParams);

      // TODO: I would love to add schemas for each of these, but in reality they are only truly useful at template design time,
      // which requires significant work on Arquero, and would only incur additional work everytime a small edit to a schema is made.
      // And make many classes generic in this library. Which would be great, but is not futhering the process of my thesis.
      this.baseTables[dict.type as keyof typeof this.baseTables] = table;
    }
    for (const bin of this.descriptor.binned) {
      if (!fs.existsSync(relativeFromDescriptor(descriptor, bin.path))) {
        throw new Error(
          `Binned file not found: ${relativeFromDescriptor(descriptor, bin.path)}`,
        );
      }
      // const table = aq.loadArrow(bin.path); // This may cause debug issues in Jest, where it seems to load an alternative FS.
      const stream = fs.readFileSync(
        relativeFromDescriptor(descriptor, bin.path),
      );
      const table = aq.fromArrow(stream);
      table.params({
        binWidth: bin.binWidth,
        ...initialParams,
      });
      this.baseTables[bin.type as keyof typeof this.baseTables] = table;
    }
    for (const series of this.descriptor.series) {
      if (!fs.existsSync(relativeFromDescriptor(descriptor, series.path))) {
        throw new Error(
          `Series file not found: ${relativeFromDescriptor(descriptor, series.path)}`,
        );
      }
      // const table = aq.loadArrow(series.path); // This may cause debug issues in Jest, where it seems to load an alternative FS.
      const stream = fs.readFileSync(
        relativeFromDescriptor(descriptor, series.path),
      );

      const table = aq.fromArrow(stream);
      table.params(initialParams);

      this.baseTables[series.type as keyof typeof this.baseTables] = table;
    }

    for (const record of this.descriptor.records) {
      if (!fs.existsSync(relativeFromDescriptor(descriptor, record.path))) {
        throw new Error(
          `Record file not found: ${relativeFromDescriptor(descriptor, record.path)}`,
        );
      }
      // const table = aq.loadArrow(record.path); // This may cause debug issues in Jest, where it seems to load an alternative FS.
      const stream = fs.readFileSync(
        relativeFromDescriptor(descriptor, record.path),
      );
      const table = aq.fromArrow(stream);
      table.params(initialParams);
      this.baseTables[record.type as keyof typeof this.baseTables] = table;
    }
  }

  parseDescriptor = (descriptor: string) => {
    return schema.parse(JSON.parse(fs.readFileSync(descriptor, "utf-8")));
  };

  addParams = <N extends string, P>(paramName: N, f: (d: typeof this) => P) => {
    Object.assign(this.derivedParams, { [paramName]: f(this) });
    return this as unknown as DataSet<
      // TODO: We return this to avoid copies of the tables, but there may be better solutions (particularily since the baseTables should be immutable).
      T,
      B,
      typeof this.derivedParams & ParamsOf<[ParamOf<N, P>]>,
      D
    >;
  };

  addTable<X extends string>(
    tableName: X,
    f: (data: typeof this) => aq.ColumnTable,
  ) {
    Object.assign(this.derivedTables, {
      [tableName]: f(this),
    });
    return this as DataSet<T, B, P, D & TablesFrom<TablesOf<[TableOf<X>]>>>;
  }

  timeToWindow = (time: number) =>
    this.descriptor.metadata.binTimes.findIndex(
      (b) => b[0] <= time && b[1] >= time,
    );

  binToTimes = (bin: number) => {
    const binTime = this.descriptor.metadata.binTimes[bin];
    if (!binTime) {
      throw new Error(`Bin ${bin} does not exist.`);
    }
    return binTime;
  };
}

const relativeFromDescriptor = (descriptor: string, relative: string) => {
  if (path.isAbsolute(relative)) {
    return relative;
  }
  return path.join(path.dirname(descriptor), relative);
};

const schema = z.object({
  name: z.string(),
  dictionaries: z.tuple([
    z.object({
      type: z.literal("strings"),
      path: z.string(),
    }),
  ]),
  binned: z.tuple([
    z.object({
      type: z.literal("players"),
      binWidth: z.number(),
      path: z.string(),
    }),
    z.object({
      type: z.literal("researchStates"),
      binWidth: z.number(),
      path: z.string(),
    }),
    z.object({
      type: z.literal("entities"),
      binWidth: z.number(),
      path: z.string(),
    }),
    z.object({
      type: z.literal("masters"),
      binWidth: z.number(),
      path: z.string(),
    }),
    z.object({
      type: z.literal("world"),
      binWidth: z.number(),
      path: z.string(),
    }),
  ]),
  series: z.tuple([
    z.object({
      type: z.literal("events"),
      path: z.string(),
    }),
  ]),
  records: z.tuple([
    z.object({
      type: z.literal("settings"),
      path: z.string(),
    }),
    z.object({
      type: z.literal("map"),
      path: z.string(),
    }),
  ]),
  metadata: z.object({
    civStringIdOffset: z.number(),
    colorStringIdOffset: z.number(),
    binTimes: z.array(z.tuple([z.number(), z.number()])),
  }),
});

