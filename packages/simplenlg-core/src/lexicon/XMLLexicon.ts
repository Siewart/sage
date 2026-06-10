/*
 * The contents of this file are subject to the Mozilla Public License
 * Version 2.0 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * https://www.mozilla.org/en-US/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is "Simplenlg".
 *
 * The Initial Developer of the Original Code is Ehud Reiter, Albert Gatt and Dave Westwater.
 * Portions created by Ehud Reiter, Albert Gatt and Dave Westwater are Copyright (C) 2010-11 The University of Aberdeen. All Rights Reserved.
 *
 * Contributor(s): Ehud Reiter, Albert Gatt, Dave Westwater, Roman Kutlak, Margaret Mitchell, and Saad Mahamood.
 *
 * TypeScript conversion: Siewart van Wingerden (University of Twente)
 */

import { XMLParser } from "fast-xml-parser";
import * as fs from "fs";
import { Inflection, InflectionCode } from "../features/Inflection.js";
import { LexicalFeature } from "../features/LexicalFeature.js";
import { Lexicon } from "./Lexicon.js";
import {
  LexicalCategory,
  LexicalCategoryValue,
  LexicalCategoryValues,
} from "../framework/LexicalCategory.js";
import { WordElement } from "../framework/WordElement.js";
import { LexiconSchema, WordSchemaType } from "../zod/xmllexicon.js";
import { NLGContext } from "../factory/NLGContext.js";
import { Gender } from "../features/Gender.js";

export class XMLLexicon extends Lexicon {
  private words = new Set<WordElement>();
  private indexByID = new Map<string, WordElement>();
  private indexByBase = new Map<string, WordElement[]>();
  private indexByVariant = new Map<string, WordElement[]>();

  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    attributesGroupName: "#attr",
    removeNSPrefix: true,
    textNodeName: "#text",
    //allowBooleanAttributes: true,
    alwaysCreateTextNode: true,
    tagValueProcessor: (_, val, jPath) => {
      if (jPath === "lexicon.word.base") {
        // this list contains values like "true" and "false" which are automatically converted to boolean
        // downside is that we cannot trim it. The alternative is disabling the default converter for all values.
        return undefined;
      }
      return val.trim();
    },
    trimValues: true,
    isArray: (_, jPath) => {
      // ensure this is an array, also when only one element is present
      return jPath === "lexicon.word";
    },
    updateTag: (tagName) => tagName.trim().toLowerCase(),
  });

  static createDefaultLexicon(context: NLGContext): XMLLexicon {
    return new XMLLexicon(context);
  }

  static createLexiconFromPathString(
    context: NLGContext,
    filename: string,
  ): XMLLexicon {
    return new XMLLexicon(context, filename);
  }

  private constructor(context: NLGContext, source?: string | File | URL) {
    super(context);
    let lexiconURI: URL;
    if (typeof source === "string") {
      lexiconURI = new URL(source, import.meta.url);
    } else if (source instanceof File) {
      lexiconURI = new URL(source.toString(), import.meta.url);
    } else if (source instanceof URL) {
      lexiconURI = source;
    } else {
      try {
        lexiconURI = new URL("default-lexicon.xml", import.meta.url);
      } catch (ex) {
        console.error(ex);
        return;
      }
    }
    this.populateLexicon(lexiconURI);
  }

  private populateLexicon(lexiconURI: URL): void {
    this.words = new Set<WordElement>();
    this.indexByID = new Map<string, WordElement>();
    this.indexByBase = new Map<string, WordElement[]>();
    this.indexByVariant = new Map<string, WordElement[]>();

    try {
      const xmlData = fs.readFileSync(lexiconURI, "utf-8");
      const jsonObj = this.parser.parse(xmlData);

      const words = LexiconSchema.parse(jsonObj);

      for (const wordNode of words.lexicon.word) {
        const word = this.convertNodeToWord(wordNode);
        this.words.add(word);
        this.indexWord(word);
      }
    } catch (ex) {
      console.error(ex);
    }

    this.addSpecialCases();
  }

  private addSpecialCases(): void {
    // TODO (later): These are English specific, should be moved to a separate class
    const be = this.getWord("be", LexicalCategory.VERB);
    if (be) {
      this.updateIndex(be, "is", this.indexByVariant);
      this.updateIndex(be, "am", this.indexByVariant);
      this.updateIndex(be, "are", this.indexByVariant);
      this.updateIndex(be, "was", this.indexByVariant);
      this.updateIndex(be, "were", this.indexByVariant);
    }
  }

  private convertNodeToWord(wordNode: WordSchemaType): WordElement {
    const category: LexicalCategory = LexicalCategoryValues.includes(
      wordNode.category as LexicalCategoryValue,
    )
      ? LexicalCategory[wordNode.category as LexicalCategoryValue]
      : LexicalCategory.ANY;

    const word = WordElement.create(
      wordNode.base,
      this.context,
      category,
      wordNode.id,
    );
    const inflections: Inflection[] = [];

    const functions: Record<
      Exclude<
        keyof WordSchemaType,
        "base" | "id" | "category" | InflectionCode
      >,
      (wordFeature: WordElement["features"], wordNode: WordSchemaType) => void
    > = {
      [LexicalFeature.CLASSIFYING]: (wordFeatures, _) => {
        wordFeatures[LexicalFeature.CLASSIFYING] = true;
      },
      [LexicalFeature.COLOUR]: (word, _) => {
        word[LexicalFeature.COLOUR] = true;
      },
      [LexicalFeature.DITRANSITIVE]: (word, _) => {
        word[LexicalFeature.DITRANSITIVE] = true;
      },
      [LexicalFeature.INTENSIFIER]: (word, _) => {
        word[LexicalFeature.INTENSIFIER] = true;
      },
      [LexicalFeature.INTRANSITIVE]: (word, _) => {
        word[LexicalFeature.INTRANSITIVE] = true;
      },
      [LexicalFeature.PREDICATIVE]: (word, _) => {
        word[LexicalFeature.PREDICATIVE] = true;
      },
      [LexicalFeature.PROPER]: (word, _) => {
        word[LexicalFeature.PROPER] = true;
      },
      [LexicalFeature.QUALITATIVE]: (word, _) => {
        word[LexicalFeature.QUALITATIVE] = true;
      },
      [LexicalFeature.REFLEXIVE]: (word, _) => {
        word[LexicalFeature.REFLEXIVE] = true;
      },
      [LexicalFeature.SENTENCE_MODIFIER]: (word, _) => {
        word[LexicalFeature.SENTENCE_MODIFIER] = true;
      },
      [LexicalFeature.TRANSITIVE]: (word, _) => {
        word[LexicalFeature.TRANSITIVE] = true;
      },
      [LexicalFeature.VERB_MODIFIER]: (word, _) => {
        word[LexicalFeature.VERB_MODIFIER] = true;
      },
      [LexicalFeature.EXPLETIVE_SUBJECT]: (word, _) => {
        word[LexicalFeature.EXPLETIVE_SUBJECT] = true;
      },
      [LexicalFeature.ACRONYM_OF]: (word, wordNode) => {
        if (wordNode.acronym_of !== undefined) {
          word[LexicalFeature.ACRONYM_OF] = wordNode.acronym_of;
        } else {
          console.error(
            `Lexicon contains invalid Acronym Of entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.ACRONYMS]: (word, wordNode) => {
        if (wordNode.acronyms !== undefined) {
          word[LexicalFeature.ACRONYMS] = wordNode.acronyms;
        } else {
          console.error(
            `Lexicon contains invalid Acronyms entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.SPELL_VARS]: (word, wordNode) => {
        if (wordNode.spell_vars !== undefined) {
          word[LexicalFeature.SPELL_VARS] = wordNode.spell_vars;
        } else {
          console.error(
            `Lexicon contains invalid Spell Vars entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.DEFAULT_SPELL]: (word, wordNode) => {
        if (wordNode.default_spell !== undefined) {
          word[LexicalFeature.DEFAULT_SPELL] = wordNode.default_spell;
        } else {
          console.error(
            `Lexicon contains invalid Default Spell entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.COMPARATIVE]: (word, wordNode) => {
        if (wordNode.comparative !== undefined) {
          word[LexicalFeature.COMPARATIVE] = wordNode.comparative;
        } else {
          console.error(
            `Lexicon contains invalid Comparative entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.GENDER]: (word, wordNode) => {
        const val = wordNode.gender
          ? Gender.fromValue(wordNode.gender)
          : undefined;
        if (val && val instanceof Gender) {
          word[LexicalFeature.GENDER] = val;
        } else {
          console.error(
            `Lexicon contains invalid Gender entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.PAST]: (word, wordNode) => {
        if (wordNode.past !== undefined) {
          word[LexicalFeature.PAST] = wordNode.past;
        } else {
          console.error(
            `Lexicon contains invalid Past entry: ${wordNode.base}`,
          );
        }
      },
      pastparticiple: (word, wordNode) => {
        if (wordNode.pastparticiple !== undefined) {
          word[LexicalFeature.PAST_PARTICIPLE] = wordNode.pastparticiple;
        } else {
          console.error(
            `Lexicon contains invalid Past Participle entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.PLURAL]: (word, wordNode) => {
        if (wordNode.plural !== undefined) {
          word[LexicalFeature.PLURAL] = wordNode.plural;
        } else {
          console.error(
            `Lexicon contains invalid Plural entry: ${wordNode.base}`,
          );
        }
      },
      presentparticiple: (word, wordNode) => {
        if (wordNode.presentparticiple !== undefined) {
          word[LexicalFeature.PRESENT_PARTICIPLE] = wordNode.presentparticiple;
        } else {
          console.error(
            `Lexicon contains invalid Present Participle entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.PRESENT3S]: (word, wordNode) => {
        if (wordNode.present3s !== undefined) {
          word[LexicalFeature.PRESENT3S] = wordNode.present3s;
        } else {
          console.error(
            `Lexicon contains invalid Present3s entry: ${wordNode.base}`,
          );
        }
      },
      [LexicalFeature.SUPERLATIVE]: (word, wordNode) => {
        if (wordNode.superlative !== undefined) {
          word[LexicalFeature.SUPERLATIVE] = wordNode.superlative;
        } else {
          console.error(
            `Lexicon contains invalid Superlative entry: ${wordNode.base}`,
          );
        }
      },
    };

    for (const key of Object.keys(wordNode)) {
      if (key === "category" || key === "base" || key === "id") {
        continue;
      }
      const featureOrInflection = key as Exclude<
        keyof WordSchemaType,
        "base" | "id" | "category"
      >;
      const inflCode = Inflection.getInflCode(featureOrInflection);
      if (inflCode !== undefined) {
        inflections.push(inflCode);
      } else {
        const k = key as Exclude<
          keyof WordSchemaType,
          "base" | "id" | "category" | InflectionCode
        >;
        if (functions[k] !== undefined) {
          functions[k](word.features, wordNode);
        } else {
          console.error(`Lexicon contains invalid entry: ${key}`);
        }
      }
    }
    const defaultInfl = inflections.includes(Inflection.REGULAR)
      ? Inflection.REGULAR
      : (inflections[0] ?? Inflection.REGULAR);

    word.features[LexicalFeature.DEFAULT_INFL] = defaultInfl;
    word.defaultInflectionalVariant = defaultInfl;

    for (const infl of inflections) {
      word.addInflectionalVariant(infl); // TODO: Conversion Note: To support more complex inflections we need to change the layout of the lexicon and how it handles inflections (i.e. nested)
    }
    return word;
  }

  private indexWord(word: WordElement): void {
    const base = word.baseForm;
    this.updateIndex(word, base, this.indexByBase);

    const id = word.id;
    if (id) {
      if (this.indexByID.has(id)) {
        console.error(`Lexicon error: ID ${id} occurs more than once`);
      }
      this.indexByID.set(id, word);
    }

    for (const variant of this.getVariants(word)) {
      this.updateIndex(word, variant, this.indexByVariant);
    }
  }

  private updateIndex(
    word: WordElement,
    base: string,
    index: Map<string, WordElement[]>,
  ): void {
    if (!index.has(base)) {
      index.set(base, []);
    }
    index.get(base)?.push(word);
  }

  override getWords(
    baseForm: string,
    category: LexicalCategory,
  ): WordElement[] {
    return this.getWordsFromIndex(baseForm, category, this.indexByBase);
  }

  private getWordsFromIndex(
    indexKey: string,
    category: LexicalCategory,
    indexMap: Map<string, WordElement[]>,
  ): WordElement[] {
    const result: WordElement[] = [];

    if (!indexMap.has(indexKey)) {
      return result;
    }

    if (category === LexicalCategory.ANY) {
      for (const word of indexMap.get(indexKey) ?? []) {
        result.push(WordElement.fromShallowCopy(word));
      }
      return result;
    } else {
      for (const word of indexMap.get(indexKey) ?? []) {
        if (word.category === category) {
          result.push(WordElement.fromShallowCopy(word));
        }
      }
    }
    return result;
  }

  getWordsByID(id: string): WordElement[] {
    const result: WordElement[] = [];
    if (this.indexByID.has(id)) {
      result.push(WordElement.fromShallowCopy(this.indexByID.get(id)!));
    }
    return result;
  }

  getWordsFromVariant(
    variant: string,
    category: LexicalCategory,
  ): WordElement[] {
    return this.getWordsFromIndex(variant, category, this.indexByVariant);
  }

  private getVariants(word: WordElement): Set<string> {
    const variants = new Set<string>();
    variants.add(word.baseForm);
    const category = word.category;
    if (category instanceof LexicalCategory) {
      switch (category) {
        case LexicalCategory.NOUN: {
          const vari = this.getVariant(word, LexicalFeature.PLURAL, "s");
          if (vari) variants.add(vari);
          break;
        }
        case LexicalCategory.ADJECTIVE: {
          variants.add(this.getVariant(word, LexicalFeature.COMPARATIVE, "er"));
          variants.add(
            this.getVariant(word, LexicalFeature.SUPERLATIVE, "est"),
          );
          break;
        }
        case LexicalCategory.VERB: {
          variants.add(this.getVariant(word, LexicalFeature.PRESENT3S, "s"));
          variants.add(this.getVariant(word, LexicalFeature.PAST, "ed"));
          variants.add(
            this.getVariant(word, LexicalFeature.PAST_PARTICIPLE, "ed"),
          );
          variants.add(
            this.getVariant(word, LexicalFeature.PRESENT_PARTICIPLE, "ing"),
          );
          break;
        }
        default: {
          break;
        }
      }
    }
    return variants;
  }

  private getVariant(
    word: WordElement,
    feature: string,
    suffix: string,
  ): string {
    const x = word.features[feature];
    return typeof x == "string" ? x : this.getForm(word.baseForm, suffix);
  }

  private getForm(base: string, suffix: string): string {
    if (base.endsWith("y") && !suffix.startsWith("i")) {
      base = base.slice(0, -1) + "ie";
    }

    if (
      base.endsWith("e") &&
      (suffix.startsWith("e") || suffix.startsWith("i"))
    ) {
      base = base.slice(0, -1);
    }

    if (
      suffix.startsWith("s") &&
      (base.endsWith("s") ||
        base.endsWith("x") ||
        base.endsWith("z") ||
        base.endsWith("ch") ||
        base.endsWith("sh"))
    ) {
      base += "e";
    }

    return base + suffix;
  }
}
