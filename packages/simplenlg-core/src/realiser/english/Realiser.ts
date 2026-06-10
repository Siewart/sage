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

import { NLGContext } from "../../factory/NLGContext.js";
import { TextFormatter } from "../../format/english/TextFormatter.js";
import { DocumentCategory } from "../../framework/DocumentCategory.js";
import { DocumentElement } from "../../framework/DocumentElement.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { NLGModule } from "../../framework/NLGModule.js";
import { MorphologyProcessor } from "../../morphology/english/MorphologyProcessor.js";
import { OrthographyProcessor } from "../../orthography/english/OrthographyProcessor.js";
import { SyntaxProcessor } from "../../syntax/english/SyntaxProcessor.js";

export class Realiser extends NLGModule {
  private morphology: MorphologyProcessor;
  private orthography: OrthographyProcessor;
  private syntax: SyntaxProcessor;
  private _formatter: NLGModule;
  private _debug = false;

  static create(context: NLGContext): Realiser {
    return new Realiser(context);
  }

  private constructor(context: NLGContext) {
    super(context);
    this.morphology = MorphologyProcessor.create(context);
    this.orthography = OrthographyProcessor.create(context);
    this.syntax = SyntaxProcessor.create(context);
    this._formatter = TextFormatter.create(context);
  }

  get commaSepPremodifiers(): boolean {
    return this.orthography.commaSepPremodifiers;
  }

  set commaSepPremodifiers(commaSepPremodifiers: boolean) {
    this.orthography.commaSepPremodifiers = commaSepPremodifiers;
  }

  get commaSepCuephrase(): boolean {
    return this.orthography.commaSepCuephrase;
  }

  set commaSepCuephrase(commaSepCuephrase: boolean) {
    this.orthography.commaSepCuephrase = commaSepCuephrase;
  }

  override realise(element: NLGElement): NLGElement {
    const debug: string[] = [];

    if (this._debug) {
      console.log("INITIAL TREE\n");
      console.log(element.printTree());
      debug.push("INITIAL TREE<br/>");
      debug.push(element.printTree("&nbsp;&nbsp;").replaceAll("\n", "<br/>"));
    }

    const postSyntax = this.syntax.realise(element);
    if (this._debug) {
      console.log("<br/>POST-SYNTAX TREE<br/>");
      console.log(postSyntax?.printTree());
      debug.push("<br/>POST-SYNTAX TREE<br/>");
      debug.push(
        postSyntax?.printTree("&nbsp;&nbsp;").replaceAll("\n", "<br/>") ?? "",
      );
    }
    const postMorphology = this.morphology.realise(postSyntax);
    if (this._debug) {
      console.log("\nPOST-MORPHOLOGY TREE\n");
      console.log(postMorphology?.printTree());
      debug.push("<br/>POST-MORPHOLOGY TREE<br/>");
      debug.push(
        postMorphology?.printTree("&nbsp;&nbsp;").replaceAll("\n", "<br/>") ??
          "",
      );
    }

    const postOrthography = this.orthography.realise(postMorphology);
    if (this._debug) {
      console.log("\nPOST-ORTHOGRAPHY TREE\n");
      console.log(postOrthography?.printTree());
      debug.push("<br/>POST-ORTHOGRAPHY TREE<br/>");
      debug.push(
        postOrthography?.printTree("&nbsp;&nbsp;").replaceAll("\n", "<br/>") ??
          "",
      );
    }

    let postFormatter: NLGElement | undefined;
    if (this._formatter) {
      postFormatter = this._formatter.realise(postOrthography);
      if (this._debug) {
        console.log("\nPOST-FORMATTER TREE\n");
        console.log(postFormatter?.printTree());
        debug.push("<br/>POST-FORMATTER TREE<br/>");
        debug.push(
          postFormatter?.printTree("&nbsp;&nbsp;").replaceAll("\n", "<br/>") ??
            "",
        );
      }
    } else {
      postFormatter = postOrthography;
    }

    if (this._debug && postFormatter) {
      postFormatter.features["debug"] = debug.join("");
    }

    return postFormatter ?? element;
  }

  realiseSentence(element: NLGElement): string | undefined {
    let realised: NLGElement | undefined;

    if (element instanceof DocumentElement) {
      realised = this.realise(element);
    } else {
      const sentence = DocumentElement.fromCategory(
        DocumentCategory.SENTENCE,
        this.context,
      );
      sentence.addComponent(element);
      realised = this.realise(sentence);
    }

    return realised?.realisation;
  }

  override realiseAll(elements: NLGElement[]): NLGElement[] {
    return elements.map((element) => this.realise(element));
  }

  override set context(context: NLGContext) {
    super.context = context;
    if (context) {
      this.syntax.context = context;
      this.morphology.context = context;
      this.orthography.context = context;
    }
  }

  override get context(): NLGContext {
    return super.context;
  }

  set formatter(formatter: NLGModule) {
    this._formatter = formatter;
  }

  set debugMode(debugOn: boolean) {
    this._debug = debugOn;
  }
}
