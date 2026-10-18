import fs from "fs";
import os from "node:os";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { doFromDataSet } from "../../gen/study/utils.js";
import {
  DATASET_CONFIGS,
  MODULE_CONFIGS,
  makeDataSet,
} from "../../gen/study/init.js";

const PKG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

process.chdir(PKG_ROOT);
const output = fs.mkdtempSync(path.join(os.tmpdir(), "sage-reports-"));
process.env["SAGE_REPORT_DIR"] = output;
const previousCache = process.env["SAGE_DATA_DIR"];
if (!previousCache) process.env["SAGE_DATA_DIR"] = path.join(output, "cache");
afterAll(() => {
  fs.rmSync(output, { recursive: true, force: true });
  delete process.env["SAGE_REPORT_DIR"];
  if (!previousCache) delete process.env["SAGE_DATA_DIR"];
});

for (const dsCfg of DATASET_CONFIGS) {
  const dataAvailable = fs.existsSync(dsCfg.descriptorPath);
  let dataSet!: ReturnType<typeof makeDataSet>;
  if (dataAvailable) {
    dataSet = makeDataSet(dsCfg);
  }

  describe(`${dsCfg.key} - ${dsCfg.label}`, () => {
    afterAll(() => dataSet?.query.close());
    for (const mod of MODULE_CONFIGS) {
      const id = `${dsCfg.key}${mod.id}`;
      const stem = `${dsCfg.label} - ${mod.config} ${id}`;

      (dataAvailable ? it : it.skip)(`${id} - ${mod.config}`, async () => {
        await doFromDataSet(dataSet, id, mod.config);
        await expect(
          fsp.access(path.resolve(output, `${stem}.md`)),
        ).resolves.toBeUndefined();
        await expect(
          fsp.access(path.resolve(output, `${stem}-data.json`)),
        ).resolves.toBeUndefined();
      });
    }
  });
}
