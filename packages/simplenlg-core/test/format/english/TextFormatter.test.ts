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

import { defaultEnglishContext } from "../../../src/factory/NLGContext.js";
import { TextFormatter } from "../../../src/format/english/TextFormatter.js";
import { Realiser } from "../../../src/realiser/english/Realiser.js";
describe("Text Formatter Tests", () => {
  const context = defaultEnglishContext;
  const realiser = Realiser.create(context);
  realiser.formatter = TextFormatter.create(context);

  test("Test Enumerated List", () => {
    const document = context.factory.createDocument("Document");
    const paragraph = context.factory.createParagraph();
    const subListSentence1 = context.factory.createSentenceSVC(
      "this",
      "be",
      "sub-list sentence 1",
    );
    const subListItem1 = context.factory.createListItem(subListSentence1);
    const subListSentence2 = context.factory.createSentenceSVC(
      "this",
      "be",
      "sub-list sentence 2",
    );
    const subListItem2 = context.factory.createListItem(subListSentence2);
    const subList = context.factory.createEnumeratedList();
    subList.addComponent(subListItem1);
    subList.addComponent(subListItem2);
    const sentence1 = context.factory.createSentenceSVC(
      "this",
      "be",
      "the first sentence",
    );
    const item1 = context.factory.createListItem(sentence1);
    const sentence2 = context.factory.createSentenceSVC(
      "this",
      "be",
      "the second sentence",
    );
    const item2 = context.factory.createListItem(sentence2);
    const list = context.factory.createEnumeratedList();
    list.addComponent(subList);
    list.addComponent(item1);
    list.addComponent(item2);
    paragraph.addComponent(list);
    document.addComponent(paragraph);
    const expectedOutput =
      "Document\n\n" +
      "1.1 - This is sub-list sentence 1.\n" +
      "1.2 - This is sub-list sentence 2.\n" +
      "2 - This is the first sentence.\n" +
      "3 - This is the second sentence.\n\n\n";
    const realisedOutput = realiser.realise(document).realisation;
    expect(realisedOutput).toBe(expectedOutput);
  });

  test("Test Enumerated List with Several Levels of Nesting", () => {
    const document = context.factory.createDocument("Document");
    const paragraph = context.factory.createParagraph();

    // sub item 1
    const subList1Sentence1 =
      context.factory.createSentenceCanned("sub-list item 1");
    const subList1Item1 = context.factory.createListItem(subList1Sentence1);

    // sub sub item 1
    const subSubList1Sentence1 = context.factory.createSentenceCanned(
      "sub-sub-list item 1",
    );
    const subSubList1Item1 =
      context.factory.createListItem(subSubList1Sentence1);

    // sub sub item 2
    const subSubList1Sentence2 = context.factory.createSentenceCanned(
      "sub-sub-list item 2",
    );
    const subSubList1Item2 =
      context.factory.createListItem(subSubList1Sentence2);

    // sub sub list
    const subSubList1 = context.factory.createEnumeratedList();
    subSubList1.addComponent(subSubList1Item1);
    subSubList1.addComponent(subSubList1Item2);

    // sub item 2
    const subList1Sentence2 =
      context.factory.createSentenceCanned("sub-list item 3");
    const subList1Item2 = context.factory.createListItem(subList1Sentence2);

    // sub list 1
    const subList1 = context.factory.createEnumeratedList();
    subList1.addComponent(subList1Item1);
    subList1.addComponent(subSubList1);
    subList1.addComponent(subList1Item2);

    // item 2
    const sentence2 = context.factory.createSentenceCanned("item 2");
    const item2 = context.factory.createListItem(sentence2);

    // item 3
    const sentence3 = context.factory.createSentenceCanned("item 3");
    const item3 = context.factory.createListItem(sentence3);

    // list
    const list = context.factory.createEnumeratedList();
    list.addComponent(subList1);
    list.addComponent(item2);
    list.addComponent(item3);

    paragraph.addComponent(list);
    document.addComponent(paragraph);

    const expectedOutput =
      "Document\n\n" +
      "1.1 - Sub-list item 1.\n" +
      "1.2.1 - Sub-sub-list item 1.\n" +
      "1.2.2 - Sub-sub-list item 2.\n" +
      "1.3 - Sub-list item 3.\n" +
      "2 - Item 2.\n" +
      "3 - Item 3.\n\n\n";
    const realisedOutput = realiser.realise(document).realisation;
    expect(realisedOutput).toBe(expectedOutput);
  });
});
