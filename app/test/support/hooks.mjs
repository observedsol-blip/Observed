// What the render tests need from node, and nothing more.
//
// Two jobs:
//
//   1. `react-native` → the stand-in next door. React Native's own index.js is Flow-typed and
//      node cannot parse it.
//   2. `.tsx` → JavaScript. `--experimental-strip-types` removes types but does NOT compile
//      JSX, so a screen is unreadable to node without a transform.
//
// The transform uses @babel/core with the TypeScript and React presets, which are ALREADY in
// this tree — expo brings them. Nothing new is installed for this, and package.json is not
// touched beyond the approved `react-test-renderer`.
//
// The tradeoff, said out loud: those three are transitive dependencies, not declared ones. If a
// future install hoists them differently, these tests stop running — loudly, with a resolution
// error, not silently with a wrong result. Declaring them is one line if that is preferred.
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");

const here = dirname(fileURLToPath(import.meta.url));
const stub = pathToFileURL(join(here, "react-native.mjs")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "react-native") return { url: stub, format: "module", shortCircuit: true };
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      // Metro resolves  without an extension and node does not. Rather
      // than rewrite every import in the app for the sake of the tests, the extension is tried
      // here — and only after node has already failed, so nothing is shadowed.
      if (e?.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw e;
      for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
        try {
          return nextResolve(specifier + ext, context);
        } catch {
          /* next candidate */
        }
      }
      throw e;
    }
  },

  load(url, context, nextLoad) {
    if (!url.startsWith("file:") || !/\.tsx?$/.test(url)) return nextLoad(url, context);
    const filename = fileURLToPath(url);
    const { code } = babel.transformSync(readFileSync(filename, "utf8"), {
      filename,
      babelrc: false,
      configFile: false,
      sourceType: "module",
      presets: [
        [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }],
        [require.resolve("@babel/preset-react"), { runtime: "automatic" }],
      ],
    });
    return { format: "module", source: code, shortCircuit: true };
  },
});
