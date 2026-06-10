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

import { NLGFactory } from "../../../src/factory/NLGFactory.js";
import { Realiser } from "../../../src/index.js";
import { TextFormatter } from "../../../src/format/english/TextFormatter.js";
import { PPPhraseSpec } from "../../../src/phrasespec/PPPhraseSpec.js";
import getTestData from "../../englishTestSet.js";
import { DocumentElement } from "../../../src/framework/DocumentElement.js";
import { Feature } from "../../../src/features/Feature.js";

describe("Orthography Format Test", () => {
  let f: NLGFactory, realiser: Realiser, d: ReturnType<typeof getTestData>;
  let inTheRoom: PPPhraseSpec,
    behindTheCurtain: PPPhraseSpec,
    onTheRock: PPPhraseSpec;
  let listItem1: DocumentElement,
    listItem2: DocumentElement,
    listItem3: DocumentElement;
  let list1: DocumentElement, list2: DocumentElement;
  const list1Realisation = "* in the room\n* behind the curtain\n";
  const list2Realisation = `* on the rock\n* ${list1Realisation}\n`;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
    realiser.formatter = TextFormatter.create(d.context);
    // Assume these PPPhraseSpecs are created via factory methods
    inTheRoom = f.createPrepositionPhrase("in", "the room");
    behindTheCurtain = f.createPrepositionPhrase("behind", "the curtain");
    onTheRock = f.createPrepositionPhrase("on", "the rock");

    // Create list items using factory.createListItem( element )
    listItem1 = f.createListItem(inTheRoom);
    listItem2 = f.createListItem(behindTheCurtain);
    listItem3 = f.createListItem(onTheRock);

    list1 = f.createList([listItem1, listItem2]);
    list2 = f.createList([listItem3, f.createListItem(list1)]);
  });

  test("Simple List Orthography", () => {
    const realised = realiser.realise(list1).realisation;
    expect(realised).toBe(list1Realisation);
  });

  test("Embedded List Orthography", () => {
    const realised = realiser.realise(list2).realisation;
    expect(realised).toBe(list2Realisation);
  });

  test("Appositive Pre Modifiers", () => {
    // Create a clause with a subject and an object; add a PP as a premodifier.
    const subject = f.createNounPhrase("I");
    const object = f.createNounPhrase("a bag");
    const clause = f.createClause(subject, "carry", object);
    const pp = f.createPrepositionPhrase(
      "on",
      f.createNounPhraseDetNoun("most", "Tuesdays"),
    );
    clause.addPreModifier(pp);
    // Without appositive feature
    expect(realiser.realise(clause).realisation).toBe(
      "I on most Tuesdays carry a bag",
    );
    // With appositive feature on pp: commas should surround it.
    pp.features[Feature.APPOSITIVE] = true;
    expect(realiser.realise(clause).realisation).toBe(
      "I, on most Tuesdays, carry a bag",
    );
  });

  test("Comma Separated Front Modifiers", () => {
    const subject = f.createNounPhrase("I");
    const object = f.createNounPhrase("a bag");
    const clause = f.createClause(subject, "carry", object);
    const pp1 = f.createPrepositionPhrase(
      "on",
      f.createNounPhraseDetNoun("most", "Tuesdays"),
    );
    const pp2 = f.createPrepositionPhrase("since", f.createNounPhrase("1991"));
    clause.addFrontModifier(pp1);
    clause.addFrontModifier(pp2);
    pp1.features["APPOSITIVE"] = true;
    pp2.features["APPOSITIVE"] = true;
    // Without comma separated cuephrase
    realiser.commaSepCuephrase = false;
    expect(realiser.realise(clause).realisation).toBe(
      "on most Tuesdays since 1991 I carry a bag",
    );
    // With comma separated cuephrase
    realiser.commaSepCuephrase = true;
    expect(realiser.realise(clause).realisation).toBe(
      "on most Tuesdays, since 1991, I carry a bag",
    );
  });

  test("No Doubled Commas", () => {
    const subject = f.createNounPhrase("I");
    const object = f.createNounPhrase("a bag");
    const clause = f.createClause(subject, "carry", object);
    const pp1 = f.createPrepositionPhrase(
      "on",
      f.createNounPhraseDetNoun("most", "Tuesdays"),
    );
    clause.addFrontModifier(pp1);
    const pp2 = f.createPrepositionPhrase("since", f.createNounPhrase("1991"));
    const pp3 = f.createPrepositionPhrase(
      "except",
      f.createNounPhrase("yesterday"),
    );
    pp2.features[Feature.APPOSITIVE] = true;
    pp3.features[Feature.APPOSITIVE] = true;
    pp1.addPostModifier(pp2);
    pp1.addPostModifier(pp3);
    realiser.commaSepCuephrase = true;
    expect(realiser.realise(clause).realisation).toBe(
      "on most Tuesdays, since 1991, except yesterday, I carry a bag",
    );
  });
});
