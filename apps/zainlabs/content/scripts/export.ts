// Writes content.json (consumed by the Python API). Run `npm run export` after editing content.
// `npm run check` fails if content.json is out of date.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { contentBundle } from "../src/index";

export const exportPath = resolve(__dirname, "..", "content.json");
export const serialize = () => JSON.stringify(contentBundle(), null, 2) + "\n";

if (require.main === module) {
  writeFileSync(exportPath, serialize());
  console.log(`wrote ${exportPath}`);
}
