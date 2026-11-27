/**
 * @jest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { JSDOM } from "jsdom";

// Builds the real webpack bundles and checks the Browser harvester survives
// bundling. It self-registers as a side effect of loading browser/agent.ts, so
// if the bundler drops that module, events are recorded but never sent.

const BUNDLES = { umd: "umd", cjs: "cjs", "cjs/browser": "cjs" };

function load(file, format) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", runScripts: "outside-only" });
  const code = fs.readFileSync(file, "utf8");
  if (format === "umd") {
    dom.window.eval(code);
    return { dom, nrvideo: dom.window.nrvideo };
  }
  dom.window.eval(`var module = { exports: {} }; var exports = module.exports;\n${code}\nwindow.__bundle = module.exports;`);
  return { dom, nrvideo: dom.window.__bundle.default };
}

describe("built bundles", () => {
  let outDir;
  let files;

  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "nrvideo-bundles-"));
    const helper = path.join(__dirname, "helpers", "build-bundles.js");
    const output = execFileSync(process.execPath, [helper, outDir, ...Object.keys(BUNDLES)], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
    });
    files = JSON.parse(output.trim().split("\n").pop());
  }, 180000);

  afterAll(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it.each(Object.keys(BUNDLES))("%s bundle registers the Browser harvester", (name) => {
    const { dom, nrvideo } = load(files[name], BUNDLES[name]);
    try {
      nrvideo.Log.level = nrvideo.Log.Levels.SILENT;
      nrvideo.Core.addTracker(new nrvideo.VideoTracker(), {
        info: { licenseKey: "FAKE", applicationID: "1", beacon: "bam.nr-data.net" },
      });
      expect(nrvideo.recordEvent("VideoAction", { actionName: "TEST" })).toBe(true);
    } finally {
      dom.window.close();
    }
  });
});
