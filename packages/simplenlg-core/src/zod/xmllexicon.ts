import { z } from "zod";
import { fromXMLText, upperCase } from "./helpers.js";
import { GenderValues } from "../features/Gender.js";
import { LexicalCategoryValues } from "../framework/LexicalCategory.js";

const booleanFromEmptyNode = z
  .literal("")
  .transform((x) => (x === "" ? true : undefined));

const booleanFeature = fromXMLText().pipe(booleanFromEmptyNode);

export const InflectionSchema = z.object({
  reg: booleanFeature.optional(),
  irreg: booleanFeature.optional(),
  regd: booleanFeature.optional(),
  glreg: booleanFeature.optional(),
  uncount: booleanFeature.optional(),
  noncount: booleanFeature.optional(),
  groupuncount: booleanFeature.optional(),
  inv: booleanFeature.optional(),
});

export const LexicalFeatureSchema = z.object({
  classifying: booleanFeature.optional(),
  colour: booleanFeature.optional(),
  ditransitive: booleanFeature.optional(),
  intensifier: booleanFeature.optional(),
  intransitive: booleanFeature.optional(),
  predicative: booleanFeature.optional(),
  proper: booleanFeature.optional(),
  qualitative: booleanFeature.optional(),
  reflexive: booleanFeature.optional(),
  sentence_modifier: booleanFeature.optional(),
  transitive: booleanFeature.optional(),
  verb_modifier: booleanFeature.optional(),
  expletive_subject: booleanFeature.optional(),
  acronym_of: fromXMLText().optional(),
  acronyms: z.array(z.string()).optional(),
  spell_vars: z.array(z.string()).optional(),
  default_spell: fromXMLText().optional(),
  comparative: fromXMLText().optional(),
  gender: z.preprocess(upperCase, z.enum(GenderValues).optional()),
  past: fromXMLText().optional(),
  pastparticiple: fromXMLText().optional(),
  plural: fromXMLText().optional(),
  presentparticiple: fromXMLText().optional(),
  present3s: fromXMLText().optional(),
  superlative: fromXMLText().optional(),
});

export const BaseWordSchema = z.object({
  id: fromXMLText().optional(),
  base: fromXMLText(),
  category: fromXMLText().pipe(
    z.preprocess(upperCase, z.enum(LexicalCategoryValues)),
  ),
});

export const WordSchema =
  BaseWordSchema.merge(LexicalFeatureSchema).merge(InflectionSchema);
export type WordSchemaType = z.infer<typeof WordSchema>;
export type BaseWordSchemaType = z.infer<typeof BaseWordSchema>;
export const LexiconSchema = z.object({
  lexicon: z.object({
    word: z.array(WordSchema),
  }),
});
export type LexiconSchemaType = z.infer<typeof WordSchema>;
