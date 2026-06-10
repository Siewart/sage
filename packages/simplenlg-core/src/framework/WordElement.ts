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

import { NLGContext } from "../factory/NLGContext.js";
import { LexicalCategory } from "./LexicalCategory.js";
import { BaseFeatureSet, NLGElement } from "./NLGElement.js";
import { cloneInto, javaLikeEquals } from "../utils.js";
import { Inflection } from "../features/Inflection.js";
import {
  getInflectionalFeatures,
  LexicalFeature,
} from "../features/LexicalFeature.js";

/**
 * Internal class to maintain inflectional variants of the word
 */
class InflectionSet {
  private _forms: Map<string, string>;

  constructor(public readonly _infl: Inflection) {
    // _infl is used for (de)serialization
    this._forms = new Map<string, string>();
  }

  public addForm(feature: string, form: string): void {
    this._forms.set(feature, form);
  }

  public getForm(feature: string): string | undefined {
    return this._forms.get(feature);
  }
}

/**
 * This is the class for a lexical entry (ie, a word). Words are stored in a Lexicon,
 * and usually the developer retrieves a WordElement via a lookup method in the lexicon
 */
export class WordElement extends NLGElement {
  override defaultValues: {
    [k in string]: string | number | boolean | object | undefined;
  };

  readonly features: typeof this.defaultValues & Partial<BaseFeatureSet>;

  override resetFeatures(): void {
    cloneInto(this.defaultValues, this.features, true);
  }

  private _baseForm: string;
  private _id: string | undefined;
  private _inflVars: Map<Inflection, InflectionSet>;
  private _defaultInfl: Inflection | undefined;

  public static create(
    baseForm: string,
    context: NLGContext,
    category?: LexicalCategory,
    id?: string,
  ): WordElement {
    return new WordElement(baseForm, context, category, id);
  }

  private constructor(
    baseForm: string,
    context: NLGContext,
    category: LexicalCategory = LexicalCategory.ANY,
    id: string | undefined = undefined,
  ) {
    super(category, context);
    this._baseForm = baseForm;
    this.category = category;
    this._id = id;
    this._inflVars = new Map<Inflection, InflectionSet>();
    this._defaultInfl = undefined;
    this.defaultValues = {};
    this.features = { ...this.defaultValues };
  }
  // is this actually shallow?
  public static fromShallowCopy(currentWord: WordElement): WordElement {
    const word = new WordElement(
      currentWord.baseForm,
      currentWord.context,
      currentWord.category,
      currentWord.id,
    );
    word._inflVars = currentWord.inflectionalVariants;
    word._defaultInfl = currentWord.defaultInflectionalVariant;
    word.setFeatures(currentWord);
    return word;
  }

  public get baseForm(): string {
    return this._baseForm;
  }

  public get id(): string | undefined {
    return this._id;
  }

  public set baseForm(baseForm: string) {
    this._baseForm = baseForm;
  }

  public set id(id: string) {
    this._id = id;
  }

  public set defaultInflectionalVariant(variant: Inflection) {
    if (variant === undefined) {
      delete this.features[LexicalFeature.DEFAULT_INFL];
      return;
    }
    this.features[LexicalFeature.DEFAULT_INFL] = variant;
    this._defaultInfl = variant;

    if (this._inflVars.has(variant)) {
      const set = this._inflVars.get(variant)!;
      const forms = getInflectionalFeatures(this.category);

      if (forms) {
        const aggrForms = {} as { [K in string]: unknown };
        for (const f of forms) {
          const form = set.getForm(f);
          if (form) aggrForms[f] = form;
        }
        cloneInto(aggrForms, this.features, false);
      }
    }
  }

  public get defaultInflectionalVariant(): Inflection | undefined {
    return this._defaultInfl;
  }

  public get inflectionalVariants(): Map<Inflection, InflectionSet> {
    return this._inflVars;
  }

  public set defaultSpellingVariant(variant: string) {
    this.features[LexicalFeature.DEFAULT_SPELL] = variant;
  }

  public get defaultSpellingVariant(): string | undefined {
    const defSpell = this.features[LexicalFeature.DEFAULT_SPELL];
    return defSpell ?? this.baseForm ?? undefined;
  }
  public addInflectionalVariant(infl: Inflection): void;
  public addInflectionalVariant(
    infl: Inflection,
    lexicalFeature: string,
    form: string,
  ): void;
  public addInflectionalVariant(
    infl: Inflection,
    lexicalFeature?: string,
    form?: string,
  ): void {
    if (lexicalFeature && form) {
      if (this._inflVars.has(infl)) {
        this._inflVars.get(infl)?.addForm(lexicalFeature, form);
      } else {
        const set = new InflectionSet(infl);
        set.addForm(lexicalFeature, form);
        this._inflVars.set(infl, set);
      }
    } else {
      this._inflVars.set(infl, new InflectionSet(infl));
    }
  }

  public hasInflectionalVariant(infl: Inflection): boolean {
    return this._inflVars.has(infl);
  }

  public setFeatures(currentWord: WordElement): void {
    cloneInto(currentWord.features, this.features, false);
  }

  public override toString(): string {
    const category = this.category;
    return `WordElement[${this.baseForm}:${
      category?.toString() ?? "no category"
    }]`;
  }

  // TODO (later): check if this is correct according to the XML schema (i.e. are all fields optional?) Use the library to generate this?
  public toXML(): string {
    let xml = "<word>\n";

    if (this.baseForm) {
      xml += `  <base>${this.baseForm}</base>\n`;
    }

    if (this.category && this.category !== LexicalCategory.ANY) {
      xml += `  <category>${this.category.toString().toLowerCase()}</category>\n`;
    }

    if (this.id) {
      xml += `  <id>${this.id}</id>\n`;
    }

    const featureNames = [...this.getAllFeatureNames()].sort();

    for (const feature of featureNames) {
      const value = this.features[feature];
      if (value) {
        if (typeof value === "boolean") {
          if (value) {
            xml += `  <${String(feature)}/>\n`;
          }
        } else {
          xml += `  <${String(feature)}>${value.toString()}</${String(feature)}>\n`;
        }
      }
    }

    xml += "</word>\n";
    return xml;
  }

  public override getChildren(): NLGElement[] {
    return [];
  }

  public override printTree(_indent: string): string {
    return `WordElement: base=${this.baseForm}, category=${this.category?.toString()}, ${super.toString()}\n`;
  }

  public override equals(o: unknown): boolean {
    if (o instanceof WordElement) {
      return (
        (this.baseForm === o.baseForm || this.baseForm === o.baseForm) &&
        (this.id === o.id || this.id === o.id) &&
        javaLikeEquals(this.features, o.features)
      );
    }
    return false;
  }
}
