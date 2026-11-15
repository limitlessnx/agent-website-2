import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";

test("original carousel template renders real 1080x1350 PNGs with a multi-child slide counter", async () => {
  const dir = await mkdtemp(new URL("../.render-check-", import.meta.url).pathname);
  try {
    const source = await readFile(new URL("../lib/social-carousel-core.tsx", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } });
    await writeFile(`${dir}/core.mjs`, outputText);
    const { renderSlide } = await import(pathToFileURL(`${dir}/core.mjs`));
    for (const [index, type] of [[1, "hook"], [5, "cta"]]) {
      const response = await renderSlide({ brandName: "Fluxknight", logoUrl: null,
        slide: { type, headline: "Keep every customer follow-up visible", body: "Assign the next action before the conversation ends." },
        index, total: 5, pillar: "Business automation" });
      const png = Buffer.from(await response.arrayBuffer());
      assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.equal(png.readUInt32BE(16), 1080);
      assert.equal(png.readUInt32BE(20), 1350);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
