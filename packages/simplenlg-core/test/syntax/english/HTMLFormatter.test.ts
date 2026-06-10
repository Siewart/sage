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

import { HTMLFormatter } from "../../../src/format/english/HTMLFormatter";
import { NLGElement } from "../../../src/framework/NLGElement";

import set from "../../englishTestSet.js";

describe("HTML Formatter", () => {
  let s: ReturnType<typeof set>;
  let context: ReturnType<typeof set>["context"];
  let realiser: ReturnType<typeof set>["realiser"];
  let f: ReturnType<typeof set>["context"]["factory"];

  beforeEach(() => {
    s = set();
    context = s.context;
    realiser = s.realiser;
    f = context.factory;
  });

  test("Web Page Content", () => {
    // now build a document ...
    const document = f.createDocument("This is a title");

    const section = f.createSection("This is a section");

    const paragraph1 = f.createParagraph();
    const sentence11 = f.createSentence(
      "This is the first sentence of paragraph 1",
    );
    paragraph1.addComponent(sentence11);
    const sentence12 = f.createSentence(
      "This is the second sentence of paragraph 1",
    );
    paragraph1.addComponent(sentence12);
    section.addComponent(paragraph1);
    document.addComponent(section);

    const paragraph2 = f.createParagraph();
    const sentence2 = f.createSentence(
      "This is the first sentence of paragraph 2",
    );
    paragraph2.addComponent(sentence2);
    document.addComponent(paragraph2);

    const paragraph3 = f.createParagraph();
    const sentence3 = f.createSentence(
      "This is the first sentence of paragraph 3",
    );
    paragraph3.addComponent(sentence3);
    document.addComponent(paragraph3);

    // now for a second section with three sentences in one paragraph using arrays.asList function
    const p1 = f.createClause("Mary", "chase", "the monkey");
    const p2 = f.createClause("the monkey", "fight back");
    const p3 = f.createClause("Mary", "be", "nervous");

    const s1 = f.createSentence(p1);
    const s2 = f.createSentence(p2);
    const s3 = f.createSentence(p3);

    const para1x3 = f.createParagraph([s1, s2, s3]);

    const sectionList = f.createSection("This section contains lists");
    sectionList.addComponent(para1x3);
    document.addComponent(sectionList);

    // from David Westwater 4-10-11
    const element = f.createList();
    const list: NLGElement[] = [];
    list.push(f.createListItem(f.createStringElement("Item 1")));
    list.push(f.createListItem(f.createStringElement("Item 2")));
    list.push(f.createListItem(f.createStringElement("Item 3")));

    element.addComponents(list);
    document.addComponent(element);

    // ... finally produce some output with HTML tags ...
    realiser.formatter = HTMLFormatter.create(context);
    const output = realiser.realise(document).realisation;

    const expectedResults =
      "<h1>This is a title</h1>" +
      "<h2>This is a section</h2>" +
      "<p>This is the first sentence of paragraph 1. This is the second sentence of paragraph 1.</p>" +
      "<p>This is the first sentence of paragraph 2.</p>" +
      "<p>This is the first sentence of paragraph 3.</p>" +
      "<h2>This section contains lists</h2>" +
      "<p>Mary chases the monkey. The monkey fights back. Mary is nervous.</p>" +
      "<ul>" +
      "<li>Item 1</li>" +
      "<li>Item 2</li>" +
      "<li>Item 3</li>" +
      "</ul>";

    expect(output).toBe(expectedResults); // when realisation is working then complete this test
  });

  test("No Header Title Content", () => {
    const document = f.createDocument();

    const section = f.createSection();

    const paragraph1 = f.createParagraph();
    const sentence11 = f.createSentence(
      "This is the first sentence of paragraph 1",
    );
    paragraph1.addComponent(sentence11);

    section.addComponent(paragraph1);
    document.addComponent(section);

    realiser.formatter = HTMLFormatter.create(context);

    const output = realiser.realise(document).realisation;

    const expectedResults = "<p>This is the first sentence of paragraph 1.</p>";

    expect(output).toBe(expectedResults);
  });
});

