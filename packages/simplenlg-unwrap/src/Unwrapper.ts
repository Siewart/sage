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
import {
  AdjPhraseSpecOutput,
  AdvPhraseSpecOutput,
  CoordinatedPhraseElementOutput,
  DocumentElementFixedOutput,
  DocumentElementOutput,
  NLGElementUnionOutput,
  NLGSpec,
  NLGSpecType,
  NPPhraseSpecOutput,
  PhraseElementUnionOutput,
  PPPhraseSpecOutput,
  SPhraseSpecOutput,
  StringElementOutput,
  VPPhraseSpecOutput,
  WordElementFixedOutput,
  WordElementOutput,
} from "./zod/XMLRequest.js";
import { NLGContext } from "simplenlg-core/factory";
import {
  Inflection,
  DiscourseFunction,
  InternalFeature,
  Feature,
  Person,
  Tense,
  NumberAgreement,
  Gender,
  LexicalFeature,
  Form,
  ClauseStatus,
  InterrogativeType,
} from "simplenlg-core/features";
import {
  NLGElement,
  DocumentElement,
  DocumentCategory,
  CoordinatedPhraseElement,
  PhraseCategory,
  StringElement,
  LexicalCategory,
  WordElement,
  PhraseElement,
} from "simplenlg-core/framework";
import {
  SPhraseSpec,
  NPPhraseSpec,
  AdjPhraseSpec,
  PPPhraseSpec,
  AdvPhraseSpec,
  VPPhraseSpec,
} from "simplenlg-core/phrasespec";

export class Unwrapper {
  context: NLGContext;
  constructor(context: NLGContext) {
    this.context = context;
  }
  static fullPathArrays = ["NLGSpec.Recording.Record"] as const;
  static endsWithArrays = [
    // These cannot be more specific
    ".frontMod",
    ".preMod",
    ".compl",
    ".postMod",
    ".coord",
    ".subj",
    ".child",
  ] as const;
  private parser = new XMLParser({
    // TODO: find a way to remove trailing spaces in leaf node multi line text, test: ./resources/CoordPhraseTest.xml (also check empty nodes)
    ignoreAttributes: false,
    // preserveOrder: true,
    attributeNamePrefix: "",
    attributesGroupName: "#attr",
    removeNSPrefix: true,
    alwaysCreateTextNode: true,
    textNodeName: "#text",
    isArray(_, jPath, __, ___) {
      return (
        Unwrapper.fullPathArrays.includes(
          jPath as (typeof Unwrapper.fullPathArrays)[number],
        ) || Unwrapper.endsWithArrays.some((x) => jPath.endsWith(x))
      );
    },
    // trimValues: true,
    parseTagValue: false,
    tagValueProcessor: (tagName: string, tagValue: string) => {
      if (tagName === "Realisation") {
        const replacement = tagValue.startsWith("\n") ? "\n" : " ";
        const result = tagValue.replaceAll(/\n\s*/g, replacement); // TODO: not sure if/how real multilines are preserved. Could be if starts with a newline, but this is not available in the parser used right now.
        return result;
      }
      return tagValue;
    },
    //updateTag: (tagName) => tagName.trim().toLowerCase(),
  });
  parse(xml: string): NLGSpecType {
    const xmlParsed = this.parser.parse(xml);
    return NLGSpec.parse(xmlParsed);
  }

  parseXML(xml: string) {
    return this.parser.parse(xml);
  }

  isDocument(wp: NLGElementUnionOutput): wp is DocumentElementOutput {
    return wp["#attr"].type === "DocumentElement";
  }
  isCoordinatedPhrase(
    wp: NLGElementUnionOutput,
  ): wp is CoordinatedPhraseElementOutput {
    return wp["#attr"].type === "CoordinatedPhraseElement";
  }
  isStringElement(wp: NLGElementUnionOutput): wp is StringElementOutput {
    return wp["#attr"].type === "StringElement";
  }
  isWordElement(wp: NLGElementUnionOutput): wp is WordElementOutput {
    return wp["#attr"].type === "WordElement";
  }
  isSPhraseSpec(wp: NLGElementUnionOutput): wp is SPhraseSpecOutput {
    return wp["#attr"].type === "SPhraseSpec";
  }
  isNPPhraseSpec(wp: NLGElementUnionOutput): wp is NPPhraseSpecOutput {
    return wp["#attr"].type === "NPPhraseSpec";
  }
  isAdjPhraseSpec(wp: NLGElementUnionOutput): wp is AdjPhraseSpecOutput {
    return wp["#attr"].type === "AdjPhraseSpec";
  }
  isPPPhraseSpec(wp: NLGElementUnionOutput): wp is PPPhraseSpecOutput {
    return wp["#attr"].type === "PPPhraseSpec";
  }
  isAdvPhraseSpec(wp: NLGElementUnionOutput): wp is AdvPhraseSpecOutput {
    return wp["#attr"].type === "AdvPhraseSpec";
  }
  isVPPhraseSpec(wp: NLGElementUnionOutput): wp is VPPhraseSpecOutput {
    return wp["#attr"].type === "VPPhraseSpec";
  }

  unwrapNLGElement(wp: NLGElementUnionOutput): NLGElement | undefined {
    switch (wp["#attr"].type) {
      case "DocumentElement":
        return this.unwrapDocumentElement(wp as DocumentElementOutput);
      case "CoordinatedPhraseElement":
        return this.unwrapCoordinatePhraseSpec(
          wp as CoordinatedPhraseElementOutput,
        );
      case "StringElement":
        return this.unwrapStringElement(wp as StringElementOutput);
      case "WordElement":
        return this.unwrapWordElement(wp as WordElementOutput);
      case "SPhraseSpec":
        return this.unwrapSPhraseSpec(wp as SPhraseSpecOutput);
      case "NPPhraseSpec":
        return this.unwrapNPPhraseSpec(wp as NPPhraseSpecOutput);
      case "AdjPhraseSpec":
        return this.unwrapAdjPhraseSpec(wp as AdjPhraseSpecOutput);
      case "PPPhraseSpec":
        return this.unwrapPPPhraseSpec(wp as PPPhraseSpecOutput);
      case "AdvPhraseSpec":
        return this.unwrapAdvPhraseSpec(wp as AdvPhraseSpecOutput);
      case "VPPhraseSpec":
        return this.unwrapVPPhraseSpec(wp as VPPhraseSpecOutput);
    }
  }

  unwrapDocumentElement(
    documentElement: DocumentElementOutput | DocumentElementFixedOutput,
  ): DocumentElement {
    const document = this.context.factory.createDocument(
      documentElement["#attr"]?.title,
    );
    if (documentElement["#attr"]?.cat) {
      const value = DocumentCategory.fromDocumentValue(
        documentElement["#attr"].cat,
      );
      if (value !== undefined) {
        document.category = value;
      }
    }
    for (const wp of documentElement.child ?? []) {
      const element = this.unwrapNLGElement(wp);
      if (element !== undefined) {
        document.addComponent(element);
      }
    }
    return document;
  }

  unwrapCoordinatePhraseSpec(
    coordinatedPhraseElement: CoordinatedPhraseElementOutput,
  ): CoordinatedPhraseElement {
    const cp = this.context.factory.createCoordinatedPhrase();
    if (coordinatedPhraseElement["#attr"].cat) {
      const value = PhraseCategory.fromPhraseValue(
        coordinatedPhraseElement["#attr"].cat,
      );
      if (value !== undefined) {
        cp.category = value; // TODO (later): can we limit the allowed Categories in the class we assign to here?
      }
    }
    cp.conjunction = coordinatedPhraseElement["#attr"].conj;
    this.applyCoordinatedPhraseFeatures(coordinatedPhraseElement, cp);
    for (const p of coordinatedPhraseElement.coord) {
      const coordinate = this.unwrapNLGElement(p);
      if (coordinate !== undefined) {
        cp.addCoordinate(coordinate);
      }
    }
    return cp;
  }

  unwrapStringElement(stringElement: StringElementOutput): StringElement {
    return this.context.factory.createStringElement(stringElement.val);
  }

  unwrapWordElement(
    wordElement: WordElementOutput | WordElementFixedOutput,
  ): NLGElement {
    if (wordElement["#attr"]?.canned) {
      return this.context.factory.createStringElement(wordElement.base);
    }

    const base = wordElement.base;
    const cat =
      wordElement["#attr"]?.cat !== undefined
        ? (LexicalCategory.fromLexicalValue(wordElement["#attr"]?.cat) ??
          LexicalCategory.ANY)
        : LexicalCategory.ANY;
    const word = this.context.factory.createWord(base, cat);
    // Conversion note, in our implemenation baseForm is never empty, but it can be in Java, skipping nullifying the word;
    if (word instanceof WordElement) {
      if (wordElement["#attr"]?.var) {
        const defInflVariant = Inflection.fromInflectionValue(
          wordElement["#attr"].var,
        );
        if (defInflVariant !== undefined) {
          word.defaultInflectionalVariant = defInflVariant;
        }
      }
      if (base !== word.baseForm) {
        word.defaultSpellingVariant = base;
      }
    }
    return word;
  }

  unwrapSPhraseSpec(sPhraseSpec: SPhraseSpecOutput): SPhraseSpec | undefined {
    const vp = this.unwrapNLGElement(sPhraseSpec.vp);
    if (vp === undefined) {
      console.error("SPhraseSpec vp is undefined");
      return undefined;
    }
    const sp = this.context.factory.createClauseVP(vp);
    const subjects: NLGElement[] = [];
    for (const p of sPhraseSpec.subj ?? []) {
      const p1 = this.unwrapNLGElement(p);
      if (p1 !== undefined) {
        this.checkFunction(DiscourseFunction.SUBJECT, p1);
        subjects.push(p1);
      }
    }
    if (subjects.length > 0) {
      sp.features[InternalFeature.SUBJECTS] = subjects;
    }

    if (sPhraseSpec.cuePhrase) {
      const cue = this.unwrapNLGElement(sPhraseSpec.cuePhrase);
      if (cue === undefined) {
        console.error("SPhraseSpec cuePhrase is undefined");
        return undefined;
      }
      cue.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.CUE_PHRASE;
      sp.features[Feature.CUE_PHRASE] = cue;
    }

    if (sPhraseSpec["#attr"].COMPLEMENTISER) {
      sp.features[Feature.COMPLEMENTISER] = this.context.factory.createWord(
        sPhraseSpec["#attr"].COMPLEMENTISER,
        LexicalCategory.COMPLEMENTISER,
      );
    }

    this.setSFeatures(sPhraseSpec, sp, vp);
    this.applyPhraseComponents(sp, sPhraseSpec);

    return sp;
  }

  unwrapNPPhraseSpec(
    npPhraseSpec: NPPhraseSpecOutput,
  ): NPPhraseSpec | undefined /* todo: fix undefined away */ {
    if (npPhraseSpec.head === undefined) {
      // todo: head element can be undefined, bu the Java code pretents it can't.
      console.error("NPPhraseSpec head is undefined");
      return undefined;
    }
    const headElement = this.unwrapWordElement(npPhraseSpec.head);
    const p = this.context.factory.createNounPhrase(headElement);
    if (npPhraseSpec.spec) {
      const spec = this.isWordElement(npPhraseSpec.spec)
        ? this.unwrapWordElement(npPhraseSpec.spec)
        : this.unwrapNLGElement(npPhraseSpec.spec);
      if (spec !== undefined) {
        p.specifier = spec;
      }
    }
    this.setNPFeatures(npPhraseSpec, p);
    this.applyPhraseComponents(p, npPhraseSpec);
    this.applyDiscourseFunction(npPhraseSpec, p);
    this.applyAppositiveFeature(npPhraseSpec, p);

    return p;
  }

  unwrapAdjPhraseSpec(
    adjPhraseSpec: AdjPhraseSpecOutput,
  ): AdjPhraseSpec | undefined {
    if (adjPhraseSpec.head === undefined) {
      // todo: head element can be undefined, bu the Java code pretents it can't.
      console.error("AdjPhraseSpec head is undefined");
      return undefined;
    }
    const headElement = this.unwrapWordElement(adjPhraseSpec.head);
    const p = this.context.factory.createAdjectivePhrase(headElement);
    headElement.features[Feature.IS_COMPARATIVE] =
      adjPhraseSpec["#attr"].IS_COMPARATIVE ?? false;
    headElement.features[Feature.IS_SUPERLATIVE] =
      adjPhraseSpec["#attr"].IS_SUPERLATIVE ?? false;
    this.applyPhraseComponents(p, adjPhraseSpec);
    this.applyDiscourseFunction(adjPhraseSpec, p);
    this.applyAppositiveFeature(adjPhraseSpec, p);

    return p;
  }

  unwrapPPPhraseSpec(
    ppPhraseSpec: PPPhraseSpecOutput,
  ): PPPhraseSpec | undefined {
    if (ppPhraseSpec.head === undefined) {
      // todo: head element can be undefined, bu the Java code pretents it can't.
      console.error("PPPhraseSpec head is undefined");
      return undefined;
    }
    const headElement = this.unwrapWordElement(ppPhraseSpec.head);
    const p = this.context.factory.createPrepositionPhrase(headElement);
    this.applyPhraseComponents(p, ppPhraseSpec);
    this.applyDiscourseFunction(ppPhraseSpec, p);
    this.applyAppositiveFeature(ppPhraseSpec, p);

    return p;
  }

  unwrapAdvPhraseSpec(
    advPhraseSpec: AdvPhraseSpecOutput,
  ): AdvPhraseSpec | undefined {
    if (advPhraseSpec.head === undefined) {
      // todo: head element can be undefined, bu the Java code pretents it can't.
      console.error("AdvhraseSpec head is undefined");
      return undefined;
    }
    const headElement = this.unwrapWordElement(advPhraseSpec.head);
    const p = this.context.factory.createAdverbPhrase(headElement);
    headElement.features[Feature.IS_COMPARATIVE] =
      advPhraseSpec["#attr"].IS_COMPARATIVE ?? false;
    headElement.features[Feature.IS_SUPERLATIVE] =
      advPhraseSpec["#attr"].IS_SUPERLATIVE ?? false;
    this.applyPhraseComponents(p, advPhraseSpec);
    this.applyDiscourseFunction(advPhraseSpec, p);
    this.applyAppositiveFeature(advPhraseSpec, p);

    return p;
  }

  unwrapVPPhraseSpec(
    vpPhraseSpec: VPPhraseSpecOutput,
  ): VPPhraseSpec | undefined {
    if (vpPhraseSpec.head === undefined) {
      // todo: head element can be undefined, bu the Java code pretents it can't.
      console.error("VPPhraseSpec head is undefined");
      return undefined;
    }
    const headElement = this.unwrapWordElement(vpPhraseSpec.head);
    const p = this.context.factory.createVerbPhrase(headElement);
    this.setVPFeatures(vpPhraseSpec, p);
    this.applyPhraseComponents(p, vpPhraseSpec);
    this.applyDiscourseFunction(vpPhraseSpec, p);
    this.applyAppositiveFeature(vpPhraseSpec, p);

    return p;
  }

  applyDiscourseFunction(
    pharseElement: PhraseElementUnionOutput,
    element: PhraseElement,
  ): void {
    if (pharseElement["#attr"].discourseFunction) {
      const discourseFunction = DiscourseFunction.fromValue(
        pharseElement["#attr"].discourseFunction,
      );
      if (discourseFunction !== undefined) {
        element.features[InternalFeature.DISCOURSE_FUNCTION] =
          discourseFunction;
      }
    }
  }

  applyAppositiveFeature(
    phraseElement: PhraseElementUnionOutput,
    element: PhraseElement,
  ): void {
    if (phraseElement["#attr"].appositive) {
      element.features[Feature.APPOSITIVE] = phraseElement["#attr"].appositive;
    }
  }

  private checkFunction(func: DiscourseFunction, element: NLGElement) {
    if (!(InternalFeature.DISCOURSE_FUNCTION in element.features)) {
      element.features[InternalFeature.DISCOURSE_FUNCTION] = func;
    }
  }

  applyPhraseComponents(hp: PhraseElement, wp: PhraseElementUnionOutput): void {
    // Front modifiers
    for (const p of wp.frontMod ?? []) {
      const p1 = this.unwrapNLGElement(p);
      if (p1 !== undefined) {
        this.checkFunction(DiscourseFunction.FRONT_MODIFIER, p1);
        hp.addFrontModifier(p1);
      }
    }

    // Pre modifiers
    for (const p of wp.preMod ?? []) {
      const p1 = this.unwrapNLGElement(p);
      if (p1 !== undefined) {
        this.checkFunction(DiscourseFunction.PRE_MODIFIER, p1);
        hp.addPreModifier(p1);
      }
    }

    // Post modifiers
    for (const p of wp.postMod ?? []) {
      const p1 = this.unwrapNLGElement(p);
      if (p1 !== undefined) {
        this.checkFunction(DiscourseFunction.POST_MODIFIER, p1);
        hp.addPostModifier(p1);
      }
    }

    // Complements
    for (const p of wp.compl ?? []) {
      const p1 = this.unwrapNLGElement(p);
      if (p1 !== undefined) {
        this.checkFunction(DiscourseFunction.OBJECT, p1);
        hp.addComplement(p1);
      }
    }
  }
  applyCoordinatedPhraseFeatures(
    wp: CoordinatedPhraseElementOutput,
    p: CoordinatedPhraseElement,
  ): void {
    if (wp["#attr"].PERSON) {
      const person = Person.fromValue(wp["#attr"].PERSON);
      if (person !== undefined) {
        p.features[Feature.PERSON] = person;
      }
    }

    if (wp["#attr"].TENSE) {
      const tense = Tense.fromValue(wp["#attr"].TENSE);
      if (tense !== undefined) {
        p.features[Feature.TENSE] = tense;
      }
    }

    if (wp["#attr"].MODAL) {
      p.features[Feature.MODAL] = wp["#attr"].MODAL;
    }

    if (wp["#attr"].NUMBER) {
      const number = NumberAgreement.fromValue(wp["#attr"].NUMBER);
      if (number !== undefined) {
        p.features[Feature.NUMBER] = number;
      }
    }

    // Boolean features
    p.features[Feature.APPOSITIVE] = wp["#attr"].APPOSITIVE ?? false;
    p.features[Feature.NEGATED] = wp["#attr"].NEGATED ?? false;
    p.features[Feature.POSSESSIVE] = wp["#attr"].POSSESSIVE ?? false;
    p.features[Feature.PROGRESSIVE] = wp["#attr"].PROGRESSIVE ?? false;
    p.features[Feature.RAISE_SPECIFIER] = wp["#attr"].RAISE_SPECIFIER ?? false;
    p.features[Feature.SUPRESSED_COMPLEMENTISER] =
      wp["#attr"].SUPRESSED_COMPLEMENTISER ?? false;
  }

  setNPFeatures(wp: NPPhraseSpecOutput, p: NPPhraseSpec): void {
    if (wp["#attr"].NUMBER) {
      const number = NumberAgreement.fromValue(wp["#attr"].NUMBER);
      if (number !== undefined) {
        p.features[Feature.NUMBER] = number;
      }
    }

    if (wp["#attr"].PERSON) {
      const person = Person.fromValue(wp["#attr"].PERSON);
      if (person !== undefined) {
        p.features[Feature.PERSON] = person;
      }
    }

    if (wp["#attr"].GENDER) {
      const gender = Gender.fromValue(wp["#attr"].GENDER);
      if (gender !== undefined) {
        p.features[LexicalFeature.GENDER] = gender;
      }
    }

    p.features[Feature.ELIDED] = wp["#attr"].ELIDED ?? false;
    p.features[Feature.POSSESSIVE] = wp["#attr"].POSSESSIVE ?? false;
    p.features[Feature.PRONOMINAL] = wp["#attr"].PRONOMINAL ?? false;
  }

  private setVPFeatures(wp: VPPhraseSpecOutput, p: VPPhraseSpec): void {
    if (wp["#attr"].FORM) {
      const form = Form.fromValue(wp["#attr"].FORM);
      if (form !== undefined) {
        p.features[Feature.FORM] = form;
      }
    }

    if (wp["#attr"].PERSON) {
      const person = Person.fromValue(wp["#attr"].PERSON);
      if (person !== undefined) {
        p.features[Feature.PERSON] = person;
      }
    }

    if (wp["#attr"].TENSE) {
      const tense = Tense.fromValue(wp["#attr"].TENSE);
      if (tense !== undefined) {
        p.features[Feature.TENSE] = tense;
      }
    }

    if (wp["#attr"].MODAL) {
      p.features[Feature.MODAL] = wp["#attr"].MODAL;
    }

    p.features[Feature.AGGREGATE_AUXILIARY] =
      wp["#attr"].AGGREGATE_AUXILIARY ?? false;
    p.features[Feature.NEGATED] = wp["#attr"].NEGATED ?? false;
    p.features[Feature.PASSIVE] = wp["#attr"].PASSIVE ?? false;
    p.features[Feature.PERFECT] = wp["#attr"].PERFECT ?? false;
    p.features[Feature.PROGRESSIVE] = wp["#attr"].PROGRESSIVE ?? false;
    p.features[Feature.SUPPRESS_GENITIVE_IN_GERUND] =
      wp["#attr"].SUPPRESS_GENITIVE_IN_GERUND ?? false;
    p.features[Feature.SUPRESSED_COMPLEMENTISER] =
      wp["#attr"].SUPRESSED_COMPLEMENTISER ?? false;
  }
  private setSFeatures(
    wp: SPhraseSpecOutput,
    sp: SPhraseSpec,
    vp: NLGElement | undefined,
  ): void {
    // TODO (debug): this should set both sp and vp features from wp
    if (wp["#attr"].CLAUSE_STATUS) {
      const status = ClauseStatus.fromValue(wp["#attr"].CLAUSE_STATUS);
      if (status !== undefined) {
        sp.features[InternalFeature.CLAUSE_STATUS] = status;
      }
    }

    if (wp["#attr"].PERSON) {
      const person = Person.fromValue(wp["#attr"].PERSON);
      if (person !== undefined) {
        sp.features[Feature.PERSON] = person;
      }
    }

    if (wp["#attr"].FORM) {
      const form = Form.fromValue(wp["#attr"].FORM);
      if (form !== undefined) {
        sp.features[Feature.FORM] = form;
      }
    }

    if (wp["#attr"].TENSE) {
      const tense = Tense.fromValue(wp["#attr"].TENSE);
      if (tense !== undefined) {
        sp.features[Feature.TENSE] = tense;
      }
    } else if (vp?.features[Feature.TENSE]) {
      const vpTense = vp.features[Feature.TENSE];
      if (vpTense !== undefined) {
        sp.features[Feature.TENSE] = vpTense;
      }
    }

    // modal -- set on S or inherited from VP
    if (wp["#attr"].MODAL) {
      sp.features[Feature.MODAL] = wp["#attr"].MODAL;
    } else if (vp?.features[Feature.MODAL]) {
      const vpModal = vp.features[Feature.MODAL];
      if (vpModal !== undefined) {
        sp.features[Feature.MODAL] = vpModal;
      }
    }

    // interrogative
    if (wp["#attr"].INTERROGATIVE_TYPE) {
      const interrogativeType = InterrogativeType.fromInterrogativeValue(
        wp["#attr"].INTERROGATIVE_TYPE,
      );
      if (interrogativeType !== undefined) {
        sp.features[Feature.INTERROGATIVE_TYPE] = interrogativeType;
      }
    } else if (vp?.features[Feature.INTERROGATIVE_TYPE]) {
      const vpInterrogativeType = vp.features[Feature.INTERROGATIVE_TYPE];
      if (vpInterrogativeType !== undefined) {
        sp.features[Feature.INTERROGATIVE_TYPE] = vpInterrogativeType;
      }
    }

    // Boolean features that can be set on clause or VP
    const boolFeatures = [
      ["AGGREGATE_AUXILIARY", Feature.AGGREGATE_AUXILIARY],
      ["PASSIVE", Feature.PASSIVE],
      ["PROGRESSIVE", Feature.PROGRESSIVE],
      ["PERFECT", Feature.PERFECT],
      ["NEGATED", Feature.NEGATED],
      ["SUPPRESS_GENITIVE_IN_GERUND", Feature.SUPPRESS_GENITIVE_IN_GERUND],
      ["SUPRESSED_COMPLEMENTISER", Feature.SUPRESSED_COMPLEMENTISER],
    ] as const;

    for (const [wpKey, featureKey] of boolFeatures) {
      const sValue = wp["#attr"][wpKey] ?? false;
      const vValue = vp?.features[featureKey] ?? false;
      sp.features[featureKey] = sValue || vValue;
    }
  }
}
