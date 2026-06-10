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

import { LexicalFeature } from "../features/LexicalFeature.js";
import { Feature } from "../features/Feature.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { DiscourseFunction } from "../features/DiscourseFunction.js";
import { NLGElement } from "../framework/NLGElement.js";
import { PhraseSet } from "./PhraseSet.js";
import { SPhraseSpec } from "../phrasespec/SPhraseSpec.js";
import { arrayEquals } from "../utils.js";

export abstract class PhraseChecker {
  static sameSentences(...sentences: NLGElement[]): boolean {
    let equal = false;

    if (sentences.length >= 2) {
      for (let i = 1; i < sentences.length; i++) {
        equal = sentences[i - 1]?.equals(sentences[i]) ?? false;
      }
    }

    return equal;
  }

  static expletiveSubjects(...sentences: NLGElement[]): boolean {
    let expl = true;

    for (let i = 1; i < sentences.length && expl; i++) {
      expl =
        sentences[i] instanceof SPhraseSpec
          ? (sentences[i]?.features[LexicalFeature.EXPLETIVE_SUBJECT] ?? false)
          : false;
    }

    return expl;
  }

  static sameFrontMods(...sentences: NLGElement[]): boolean {
    let equal = true;

    if (sentences.length >= 2) {
      for (let i = 1; i < sentences.length && equal; i++) {
        if (
          sentences[i - 1]?.features[Feature.CUE_PHRASE] === undefined &&
          sentences[i]?.features[Feature.CUE_PHRASE] === undefined
        ) {
          equal = arrayEquals(
            sentences[i - 1]?.features[InternalFeature.FRONT_MODIFIERS] ?? [],
            sentences[i]?.features[InternalFeature.FRONT_MODIFIERS] ?? [],
          );
        } else if (
          sentences[i - 1]?.features[Feature.CUE_PHRASE] !== undefined &&
          sentences[i]?.features[Feature.CUE_PHRASE] !== undefined
        ) {
          const cueCurrent = sentences[i]?.features[Feature.CUE_PHRASE];
          const cuePrevious = sentences[i - 1]?.features[Feature.CUE_PHRASE];
          equal =
            arrayEquals(
              sentences[i - 1]?.features[InternalFeature.FRONT_MODIFIERS] ?? [],
              sentences[i]?.features[InternalFeature.FRONT_MODIFIERS] ?? [],
            ) &&
            arrayEquals(
              cueCurrent !== undefined ? [cueCurrent] : [],
              cuePrevious !== undefined ? [cuePrevious] : [],
            );
        } else {
          equal = false;
        }
      }
    }

    return equal;
  }

  static samePostMods(...sentences: NLGElement[]): boolean {
    let equal = true;

    if (sentences.length >= 2) {
      for (let i = 1; i < sentences.length && equal; i++) {
        equal = arrayEquals(
          sentences[i - 1]?.features[InternalFeature.POSTMODIFIERS] ?? [],
          sentences[i]?.features[InternalFeature.POSTMODIFIERS] ?? [],
        );
      }
    }

    return equal;
  }

  static sameSubjects(...sentences: NLGElement[]): boolean {
    let equal = sentences.length >= 2;

    for (let i = 1; i < sentences.length && equal; i++) {
      equal = arrayEquals(
        sentences[i - 1]?.features[InternalFeature.SUBJECTS] ?? [],
        sentences[i]?.features[InternalFeature.SUBJECTS] ?? [],
      );
    }

    return equal;
  }

  static allPassive(...sentences: NLGElement[]): boolean {
    let passive = true;

    for (let i = 0; i < sentences.length && passive; i++) {
      passive = sentences[i]?.features[Feature.PASSIVE] ?? false;
    }

    return passive;
  }

  static allActive(...sentences: NLGElement[]): boolean {
    let active = true;

    for (let i = 0; i < sentences.length && active; i++) {
      active = !(sentences[i]?.features[Feature.PASSIVE] ?? false);
    }

    return active;
  }

  static sameSurfaceSubjects(...sentences: NLGElement[]): boolean {
    return (
      (PhraseChecker.allActive(...sentences) &&
        PhraseChecker.sameSubjects(...sentences)) ||
      PhraseChecker.allPassive(...sentences)
    );
  }

  static sameVPHead(...sentences: NLGElement[]): boolean {
    let equal = sentences.length >= 2;

    // Note: we also check equal here
    for (let i = 1; i < sentences.length && equal; i++) {
      const vp1 = sentences[i - 1]?.features[InternalFeature.VERB_PHRASE];
      const vp2 = sentences[i]?.features[InternalFeature.VERB_PHRASE];

      if (vp1 && vp2) {
        const h1 = vp1.features[InternalFeature.HEAD];
        const h2 = vp2.features[InternalFeature.HEAD];
        equal = h1 && h2 ? h1.equals(h2) : false; // Note: we first check if h1 and h1 are not undefined, which is not the same as the .equals check, which allows two undefined values for equality
      } else {
        equal = false;
      }
    }

    return equal;
  }

  static haveSameVoice(...sentences: NLGElement[]): boolean {
    let samePassive = true;
    let prevIsPassive = false;

    if (sentences.length > 1) {
      prevIsPassive = sentences[0]?.features[Feature.PASSIVE] ?? false;

      for (let i = 1; i < sentences.length && samePassive; i++) {
        samePassive = sentences[i]?.features[Feature.PASSIVE] === prevIsPassive;
      }
    }

    return samePassive;
  }

  static sameVP(...sentences: NLGElement[]): boolean {
    let equal = sentences.length >= 2;
    // Note: we also check equal here
    for (let i = 1; i < sentences.length && equal; i++) {
      equal =
        sentences[i - 1]?.features[InternalFeature.VERB_PHRASE]?.equals(
          sentences[i]?.features[InternalFeature.VERB_PHRASE],
        ) ?? false;
    }

    return equal; // || true;
  }

  static sameVPArgs(...sentences: NLGElement[]): boolean {
    let equal = sentences.length >= 2;

    for (let i = 1; i < sentences.length && equal; i++) {
      const vp1 = sentences[i - 1]?.features[InternalFeature.VERB_PHRASE];
      const vp2 = sentences[i]?.features[InternalFeature.VERB_PHRASE];

      equal = arrayEquals(
        vp1?.features[InternalFeature.COMPLEMENTS] ?? [],
        vp2?.features[InternalFeature.COMPLEMENTS] ?? [],
      );
    }

    return equal;
  }

  static sameVPModifiers(...sentences: NLGElement[]): boolean {
    let equal = sentences.length >= 2;

    for (let i = 1; i < sentences.length && equal; i++) {
      const vp1 = sentences[i - 1]?.features[InternalFeature.VERB_PHRASE];
      const vp2 = sentences[i]?.features[InternalFeature.VERB_PHRASE];

      equal =
        arrayEquals(
          vp1?.features[InternalFeature.POSTMODIFIERS] ?? [],
          vp2?.features[InternalFeature.POSTMODIFIERS] ?? [],
        ) &&
        arrayEquals(
          vp1?.features[InternalFeature.PREMODIFIERS] ?? [],
          vp2?.features[InternalFeature.PREMODIFIERS] ?? [],
        );
    }

    return equal;
  }

  static leftPeriphery(...sentences: NLGElement[]): PhraseSet[] {
    const funcsets: PhraseSet[] = [];
    const cue = PhraseSet.fromFunctionAndPhrases(DiscourseFunction.CUE_PHRASE);
    const front = PhraseSet.fromFunctionAndPhrases(
      DiscourseFunction.FRONT_MODIFIER,
    );
    const subj = PhraseSet.fromFunctionAndPhrases(DiscourseFunction.SUBJECT);

    for (const s of sentences) {
      const cuePhrases = s.features[Feature.CUE_PHRASE];
      if (cuePhrases !== undefined) {
        cue.addPhrases([cuePhrases]);
      }

      const frontMods = s.features[InternalFeature.FRONT_MODIFIERS];
      if (frontMods !== undefined) {
        front.addPhrases(frontMods);
      }

      const subjects = s.features[InternalFeature.SUBJECTS];
      if (subjects !== undefined) {
        subj.addPhrases(subjects);
      }
    }

    funcsets.push(cue, front, subj);
    return funcsets;
  }

  static rightPeriphery(...sentences: NLGElement[]): PhraseSet[] {
    const funcsets: PhraseSet[] = [];
    const comps = PhraseSet.fromFunctionAndPhrases(DiscourseFunction.OBJECT);
    const pmods = PhraseSet.fromFunctionAndPhrases(
      DiscourseFunction.POST_MODIFIER,
    );

    for (const s of sentences) {
      const vp = s.features[InternalFeature.VERB_PHRASE];

      if (vp) {
        const complements = vp.features[InternalFeature.COMPLEMENTS] ?? [];
        if (complements !== undefined) {
          comps.addPhrases(complements);
        }

        const vpPostMods = vp.features[InternalFeature.POSTMODIFIERS] ?? [];
        if (vp.features[InternalFeature.POSTMODIFIERS] !== undefined) {
          pmods.addPhrases(vpPostMods);
        }
      }

      const sPostMods = s.features[InternalFeature.POSTMODIFIERS] ?? [];
      if (s.features[InternalFeature.POSTMODIFIERS] !== undefined) {
        pmods.addPhrases(sPostMods);
      }
    }

    funcsets.push(comps, pmods);
    return funcsets;
  }

  static nonePassive(...sentences: NLGElement[]): boolean {
    return !sentences.some((s) => s.features[Feature.PASSIVE] === true);
  }
}
