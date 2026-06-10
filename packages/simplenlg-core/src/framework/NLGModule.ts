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
 * Portions created by Ehud Reiter, Albert Gatt and Dave Westwater are Copyright (C)
 * 2010-11 The University of Aberdeen. All Rights Reserved.
 *
 * Contributor(s): Ehud Reiter, Albert Gatt, Dave Westwater, Roman Kutlak,
 * Margaret Mitchell, and Saad Mahamood.
 *
 * TypeScript conversion: Siewart van Wingerden (University of Twente)
 */

import { NLGContext } from "../factory/NLGContext.js";
import { NLGElement } from "./NLGElement.js";

export abstract class NLGModule {
  protected _context: NLGContext;

  protected constructor(context: NLGContext) {
    this._context = context;
  }
  // public abstract initialise(): void;

  public abstract realise(element: NLGElement): NLGElement;
  public abstract realiseAll(elements: NLGElement[]): NLGElement[];

  public get context(): NLGContext {
    return this._context;
  }

  public set context(context: NLGContext) {
    this._context = context;
  }
}
