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

export class NumberedPrefix {
  private _prefix: string;

  static create(): NumberedPrefix {
    return new NumberedPrefix();
  }

  private constructor() {
    this._prefix = "0";
  }

  increment(): void {
    const dotPosition = this._prefix.lastIndexOf(".");
    if (dotPosition === -1) {
      const counter = Number(this._prefix);
      this._prefix = String(counter + 1);
    } else {
      const subCounterStr = this._prefix.substring(dotPosition + 1);
      const subCounter = parseInt(subCounterStr);
      this._prefix = `${this._prefix.substring(0, dotPosition)}.${subCounter + 1}`;
    }
  }

  /**
   * This method starts a new level to the prefix (e.g., 1.1 if the current is 1, 2.3.1 if current is 2.3, or 1 if the current is 0).
   */
  upALevel(): void {
    this._prefix = this._prefix === "0" ? "1" : `${this._prefix}.1`;
  }

  /**
   * This method removes a level from the prefix (e.g., 0 if current is a plain number, say, 7, or 2.4, if current is 2.4.1).
   */
  downALevel(): void {
    const dotPosition = this._prefix.lastIndexOf(".");
    this._prefix =
      dotPosition === -1 ? "0" : this._prefix.substring(0, dotPosition);
  }

  get prefix(): string {
    return this._prefix;
  }

  set prefix(prefix: string) {
    this._prefix = prefix;
  }
}
