import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { doFromDataSet } from "../../gen/study/utils.js";
import { DATASET_CONFIGS, MODULE_CONFIGS, makeDataSet } from "../../gen/study/init.js";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

process.chdir(PKG_ROOT);
fs.mkdirSync("reports", { recursive: true });

for (const dsCfg of DATASET_CONFIGS) {
  const dataAvailable = fs.existsSync(dsCfg.descriptorPath);
  let dataSet!: ReturnType<typeof makeDataSet>;
  if (dataAvailable) {
    dataSet = makeDataSet(dsCfg);
  }

  describe(`${dsCfg.key} - ${dsCfg.label}`, () => {
    for (const mod of MODULE_CONFIGS) {
      const id = `${dsCfg.key}${mod.id}`;
      const stem = `${dsCfg.label} - ${mod.config} ${id}`;

      (dataAvailable ? it : it.skip)(`${id} - ${mod.config}`, async () => {
        await doFromDataSet(dataSet, id, mod.config);
        await expect(fsp.access(path.resolve(PKG_ROOT, "reports", `${stem}.md`))).resolves.toBeUndefined();
        await expect(fsp.access(path.resolve(PKG_ROOT, "reports", `${stem}-data.json`))).resolves.toBeUndefined();
      });
    }
  });
}
