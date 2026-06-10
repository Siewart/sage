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
import { Realiser } from "../../../src/realiser/english/Realiser.js";
import { HTMLFormatter } from "../../../src/format/english/HTMLFormatter.js";
describe("EnumeratedList Tests", () => {
  const context = defaultEnglishContext;
  const htmlRealiser = Realiser.create(context);
  htmlRealiser.formatter = HTMLFormatter.create(context);
  test("Bullet lists", () => {
    const document = context.factory.createDocument("Document");
    const paragraph = context.factory.createParagraph();
    const list = context.factory.createList();
    const sentence1 = context.factory.createSentenceSVC(
      "this",
      "be",
      "the first sentence",
    );
    const sentence2 = context.factory.createSentenceSVC(
      "this",
      "be",
      "the second sentence",
    );
    const item1 = context.factory.createListItem(sentence1);
    const item2 = context.factory.createListItem(sentence2);
    list.addComponent(item1);
    list.addComponent(item2);
    paragraph.addComponent(list);
    document.addComponent(paragraph);
    const expectedOutput =
      "<h1>Document</h1>" +
      "<p>" +
      "<ul>" +
      "<li>This is the first sentence.</li>" +
      "<li>This is the second sentence.</li>" +
      "</ul>" +
      "</p>";
    const realisedOutput = htmlRealiser.realise(document).realisation;
    expect(realisedOutput).toBe(expectedOutput);
  });

  test("Enumerated lists", () => {
    const document = context.factory.createDocument("Document");
    const paragraph = context.factory.createParagraph();
    const list = context.factory.createEnumeratedList();
    const sentence1 = context.factory.createSentenceSVC(
      "this",
      "be",
      "the first sentence",
    );
    const sentence2 = context.factory.createSentenceSVC(
      "this",
      "be",
      "the second sentence",
    );
    const item1 = context.factory.createListItem(sentence1);
    const item2 = context.factory.createListItem(sentence2);
    list.addComponent(item1);
    list.addComponent(item2);
    paragraph.addComponent(list);
    document.addComponent(paragraph);
    const expectedOutput =
      "<h1>Document</h1>" +
      "<p>" +
      "<ol>" +
      "<li>This is the first sentence.</li>" +
      "<li>This is the second sentence.</li>" +
      "</ol>" +
      "</p>";
    const realisedOutput = htmlRealiser.realise(document).realisation;
    expect(realisedOutput).toBe(expectedOutput);
  });
});
