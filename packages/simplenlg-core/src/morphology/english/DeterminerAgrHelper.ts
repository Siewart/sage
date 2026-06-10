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

export class DeterminerAgrHelper {
  private static readonly AN_EXCEPTIONS = ["one", "180", "110"] as const;

  private static readonly AN_AGREEMENT = /^([aeiou]).*/;

  /**
   * Check whether this string starts with a number that needs "an" (e.g.
   * "an 18% increase")
   *
   * @param string the string
   * @return <code>true</code> if this string starts with 11, 18, or 8,
   * 		excluding strings that start with 180 or 110
   */
  public static requiresAn(text: string): boolean {
    let req = false;

    const lowercaseInput = text.toLowerCase();

    if (
      lowercaseInput.match(this.AN_AGREEMENT) &&
      !this.isAnException(lowercaseInput)
    ) {
      req = true;
    } else {
      const numPref = this.getNumericPrefix(lowercaseInput);

      if (
        numPref != null &&
        numPref.length > 0 &&
        numPref.match(/^(8|11|18).*$/)
      ) {
        const num = parseInt(numPref);
        req = this.checkNum(num);
      }
    }

    return req;
  }

  /*
   * check whether a string beginning with a vowel is an exception and doesn't
   * take "an" (e.g. "a one percent change")
   *
   * @return
   */
  private static isAnException(text: string): boolean {
    return this.AN_EXCEPTIONS.some((ex) => text.startsWith(ex));
  }

  /*
   * Returns <code>true</code> if the number starts with 8, 11 or 18 and is
   * either less than 100 or greater than 1000, but excluding 180,000 etc.
   */
  private static checkNum(num: number): boolean {
    let needsAn = false;

    // eight, eleven, eighty and eighteen
    if (num == 11 || num == 18 || num == 8 || (num >= 80 && num < 90)) {
      needsAn = true;
    } else if (num > 1000) {
      num = Math.round(num / 1000);
      needsAn = this.checkNum(num);
    }

    return needsAn;
  }

  /*
   * Retrieve the numeral prefix of a string.
   */
  private static getNumericPrefix(text: string): string | null {
    const numeric = [];

    if (text != null) {
      text = text.trim();

      if (text.length > 0) {
        const buffer = text;
        const first = buffer.charAt(0);

        if (/\d/.test(first)) {
          numeric.push(first);

          for (let i = 1; i < buffer.length; i++) {
            const next = buffer.charAt(i);

            if (/\d/.test(next)) {
              numeric.push(next);

              // skip commas within numbers
            } else if (next === ",") {
              continue;
            } else {
              break;
            }
          }
        }
      }
    }

    return numeric.length === 0 ? null : numeric.join("");
  }

  /**
   * Check to see if a string ends with the indefinite article "a" and it agrees with {@code np}.
   *
   * @return an altered version of {@code text} to use "an" if it agrees with {@code np}, the original string otherwise.
   */
  static checkEndsWithIndefiniteArticle(text: string, np: string): string {
    const tokens = text.split(" ");

    const lastToken = tokens[tokens.length - 1];

    if (
      lastToken !== undefined &&
      lastToken.toLowerCase() === "a" &&
      this.requiresAn(np)
    ) {
      tokens[tokens.length - 1] = "an";

      return this.stringArrayToString(tokens);
    }

    return text;
  }

  // Turns ["a","b","c"] into "a b c"
  private static stringArrayToString(sArray: string[]): string {
    const buf = [];

    for (let i = 0; i < sArray.length; i++) {
      buf.push(sArray[i]);

      if (i !== sArray.length - 1) {
        buf.push(" ");
      }
    }

    return buf.join("");
  }
}
