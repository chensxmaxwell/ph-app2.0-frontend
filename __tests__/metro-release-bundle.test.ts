import fs from "fs";
import path from "path";
import { transformSync } from "@babel/core";
import { describe, expect, it } from "@jest/globals";

/**
 * Metro 0.80 (React Native 0.73) drops an optional dependency it cannot
 * resolve (a `require()` inside `try`) from the module's dependency map but
 * keeps the numeric `_dependencyMap[i]` indices baked into the code. Every
 * later require in that module then points one slot too far, and the last
 * one becomes `require(undefined)`, which the Metro runtime reports through
 * `ErrorUtils.reportFatalError` -> RCTFatal in a Release IPA. This is what
 * `require("@env")` in llm-config did to the first loadLlmConfig() on send.
 *
 * These tests run the project babel config plus Metro's own dependency
 * collector over the app sources and assert that every dependency slot has a
 * module behind it.
 */

// Internal Metro worker API; pinned by react-native 0.73.6 -> metro 0.80.x.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const collectDependencies = require("metro/src/ModuleGraph/worker/collectDependencies");

// Array position is the `_dependencyMap` index Metro bakes into the module.
type MetroDependency = {
  name: string;
  data: { isOptional?: boolean; asyncType?: string | null };
};

const ROOT = path.join(__dirname, "..");
const SOURCE_EXTS = [
  "ios.tsx",
  "ios.ts",
  "ios.js",
  "native.tsx",
  "native.ts",
  "native.js",
  "tsx",
  "ts",
  "jsx",
  "js",
  "json",
  "svg",
];
const ASSET_EXTS = ["png", "jpg", "jpeg", "gif", "glb", "txt", "ttf", "otf"];

const listSources = (dir: string, out: string[] = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listSources(full, out);
    } else if (
      /\.(tsx?|jsx?)$/.test(entry.name) &&
      !/\.d\.ts$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
};

const appSources = () => [
  path.join(ROOT, "index.js"),
  path.join(ROOT, "App.tsx"),
  ...listSources(path.join(ROOT, "navigations")),
  ...listSources(path.join(ROOT, "src")),
];

const metroDependenciesOf = (file: string): MetroDependency[] => {
  const source = fs.readFileSync(file, "utf8");
  const transformed = transformSync(source, {
    filename: file,
    cwd: ROOT,
    root: ROOT,
    configFile: path.join(ROOT, "babel.config.js"),
    babelrc: false,
    ast: true,
    code: false,
    caller: { name: "metro", bundler: "metro", platform: "ios" } as {
      name: string;
    },
  });
  if (!transformed?.ast) {
    throw new Error(`Babel produced no AST for ${file}`);
  }
  const { dependencies } = collectDependencies(transformed.ast, {
    asyncRequireModulePath: "metro-runtime/src/modules/asyncRequire",
    dynamicRequires: "reject",
    inlineableCalls: [],
    keepRequireNames: false,
    allowOptionalDependencies: true,
    unstable_allowRequireContext: false,
  });
  return dependencies as MetroDependency[];
};

const fileExistsWithMetroExts = (base: string) => {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    return true;
  }
  if (
    [...SOURCE_EXTS, ...ASSET_EXTS].some((ext) =>
      fs.existsSync(`${base}.${ext}`)
    )
  ) {
    return true;
  }
  return SOURCE_EXTS.some((ext) =>
    fs.existsSync(path.join(base, `index.${ext}`))
  );
};

const resolvesForMetro = (from: string, name: string) => {
  if (name.startsWith(".") || name.startsWith("/")) {
    return fileExistsWithMetroExts(path.resolve(path.dirname(from), name));
  }
  try {
    require.resolve(name, { paths: [path.dirname(from), ROOT] });
    return true;
  } catch {
    // Metro resolves packages that only ship a react-native entry too.
    const pkgJson = path.join(ROOT, "node_modules", name, "package.json");
    return fs.existsSync(pkgJson);
  }
};

describe("Release bundle dependency maps", () => {
  it("llm-config no longer has a runtime dependency on @env", () => {
    const names = metroDependenciesOf(
      path.join(ROOT, "src/services/llm-config.ts")
    ).map((dep) => dep.name);

    expect(names).not.toContain("@env");
    expect(names).toContain("../backend/session");
    expect(names).toContain("@react-native-async-storage/async-storage");
  });

  it("every _dependencyMap slot in app code has a resolvable module behind it", () => {
    const broken: { file: string; name: string; optional: boolean }[] = [];

    for (const file of appSources()) {
      for (const dep of metroDependenciesOf(file)) {
        if (!resolvesForMetro(file, dep.name)) {
          // Metro would fail the build on a non-optional miss; an optional
          // miss is the silent index shift described above.
          broken.push({
            file: path.relative(ROOT, file),
            name: dep.name,
            optional: dep.data.isOptional === true,
          });
        }
      }
    }

    expect(broken).toEqual([]);
  });

  it("build-time env values are inlined instead of looked up at runtime", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "src/services/llm-config.ts"),
      "utf8"
    );
    expect(source).toMatch(/import \{[^}]*LLM_API_KEY[^}]*\} from "@env"/);
    expect(source).not.toMatch(/require\(\s*["']@env["']\s*\)/);
  });

  it("the cloud voice keys come from the same static @env import — MINIMAX_API_KEY beside TTS_API_KEY — with the saved Companion AI key first, and the committed example carries no value", () => {
    // react-native-dotenv inlines `@env` at build time from the gitignored
    // .env merged with the build process's environment, so Maxwell's key on
    // the Mac reaches the app through this import and nothing else: no
    // runtime require, no process.env lookup in the bundle (landmine 10).
    const source = fs.readFileSync(
      path.join(ROOT, "src/services/tts-config.ts"),
      "utf8"
    );
    expect(source).toMatch(/import \{[^}]*MINIMAX_API_KEY[^}]*\} from "@env"/);
    expect(source).toMatch(/import \{[^}]*TTS_API_KEY[^}]*\} from "@env"/);
    expect(source).not.toMatch(/require\(\s*["']@env["']\s*\)/);
    expect(source).not.toMatch(/process\.env/);
    // The key saved on the phone wins; the shipped .env is the fallback.
    expect(source).toContain("config.minimaxApiKey ?? MINIMAX_API_KEY");
    expect(source).toContain("config.ttsApiKey ?? TTS_API_KEY");
    // The example (what Jest inlines) names the variable and holds nothing.
    const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    expect(example).toMatch(/^MINIMAX_API_KEY=\s*$/m);
    expect(example).toMatch(/^TTS_API_KEY=\s*$/m);
  });
});
