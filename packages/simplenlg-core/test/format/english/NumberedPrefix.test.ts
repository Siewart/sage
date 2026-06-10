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

import { NumberedPrefix } from "../../../src/format/english/NumberedPrefix.js";
describe("Numbered Prefix Tests", () => {
  test("New instance prefix is zero", () => {
    const prefix = NumberedPrefix.create();
    expect(prefix.prefix).toBe("0");
  });

  test("Increment from new instance is one", () => {
    const prefix = NumberedPrefix.create();
    prefix.increment();
    expect(prefix.prefix).toBe("1");
  });

  test("Increment from 2.2 is 2.3", () => {
    const prefix = NumberedPrefix.create();
    prefix.prefix = "2.2";
    prefix.increment();
    expect(prefix.prefix).toBe("2.3");
  });

  test("Increment from 3.4.3 is 3.4.4", () => {
    const prefix = NumberedPrefix.create();
    prefix.prefix = "3.4.3";
    prefix.increment();
    expect(prefix.prefix).toBe("3.4.4");
  });

  test("Up a level for new instance is one", () => {
    const prefix = NumberedPrefix.create();
    prefix.upALevel();
    expect(prefix.prefix).toBe("1");
  });

  test("Down a level for new instance is zero", () => {
    const prefix = NumberedPrefix.create();
    prefix.downALevel();
    expect(prefix.prefix).toBe("0");
  });

  test("Down a level for 7 is zero", () => {
    const prefix = NumberedPrefix.create();
    prefix.prefix = "7";
    prefix.downALevel();
    expect(prefix.prefix).toBe("0");
  });

  test("Down a level for 2.7 is two", () => {
    const prefix = NumberedPrefix.create();
    prefix.prefix = "2.7";
    prefix.downALevel();
    expect(prefix.prefix).toBe("2");
  });

  test("Down a level for 2.4.1 is 2.4", () => {
    const prefix = NumberedPrefix.create();
    prefix.prefix = "3.4.3";
    prefix.downALevel();
    expect(prefix.prefix).toBe("3.4");
  });
});
