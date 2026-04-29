#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, ".codex-plugin", "plugin.json");
const args = process.argv.slice(2);
const force = args.includes("--force");
const skipMarketplace = args.includes("--skip-marketplace");

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function assertRequiredPaths(paths) {
  for (const relativePath of paths) {
    const targetPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Missing required plugin bundle path: ${relativePath}`);
    }
  }
}

function shouldCopy(sourcePath) {
  const name = path.basename(sourcePath);
  return name !== ".build" && name !== ".DS_Store";
}

function syncBundle(pluginRoot, paths) {
  let existing;
  try {
    existing = fs.lstatSync(pluginRoot);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  if (existing) {
    const markerPath = path.join(pluginRoot, ".codex-plugin-bundle.json");
    const hasMarker = fs.existsSync(markerPath);
    if (!force) {
      throw new Error(
        `${pluginRoot} already exists. Re-run with --force to replace the existing bundle.`,
      );
    }
    if (!hasMarker && !existing.isSymbolicLink()) {
      throw new Error(`${pluginRoot} exists and is not an IBR bundle. Move it first, then re-run.`);
    }
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }

  fs.mkdirSync(pluginRoot, { recursive: true });
  for (const relativePath of paths) {
    const destinationPath = path.join(pluginRoot, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.cpSync(path.join(repoRoot, relativePath), destinationPath, {
      recursive: true,
      filter: shouldCopy,
    });
  }
  writeJson(path.join(pluginRoot, ".codex-plugin-bundle.json"), {
    source: repoRoot,
    generatedAt: new Date().toISOString(),
  });
  return existing ? "replaced" : "created";
}

function marketplaceRoot(marketplacePath) {
  return path.resolve(path.dirname(marketplacePath), "..", "..");
}

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Missing Codex plugin manifest: ${manifestPath}`);
}

const manifest = readJson(manifestPath);
const pluginName = manifest.name;
if (!pluginName) {
  throw new Error(".codex-plugin/plugin.json is missing name");
}

const home = os.homedir();
const pluginRoot = path.resolve(argValue("--plugin-dir") || path.join(home, "plugins", pluginName));
const marketplacePath = path.resolve(
  argValue("--marketplace-path") || path.join(home, ".agents", "plugins", "marketplace.json"),
);
const bundlePaths = [
  ".codex-plugin",
  "dist",
  path.join("templates", "design-system.json"),
  path.join("src", "native", "swift", "ibr-ax-extract"),
];

assertRequiredPaths([
  ...bundlePaths,
  path.join("dist", "mcp", "server.js"),
  path.join("templates", "design-system.json"),
]);

const bundleStatus = syncBundle(pluginRoot, bundlePaths);

if (skipMarketplace) {
  console.log(`Codex plugin bundle: ${pluginRoot} (${bundleStatus})`);
  console.log("Marketplace entry skipped.");
  process.exit(0);
}

const rootForMarketplace = marketplaceRoot(marketplacePath);
const relativeSource = toPosix(path.relative(rootForMarketplace, pluginRoot));
const sourcePath = relativeSource.startsWith(".") ? relativeSource : `./${relativeSource}`;
const marketplace = readJson(marketplacePath, {
  name: "local",
  interface: {
    displayName: "Local Plugins",
  },
  plugins: [],
});

marketplace.name ||= "local";
marketplace.interface ||= {};
marketplace.interface.displayName ||= "Local Plugins";
marketplace.plugins ||= [];

const entry = {
  name: pluginName,
  source: {
    source: "local",
    path: sourcePath,
  },
  policy: {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  },
  category: "Coding",
};

const existingIndex = marketplace.plugins.findIndex((plugin) => plugin.name === pluginName);
let marketplaceStatus = "added";

if (existingIndex === -1) {
  marketplace.plugins.push(entry);
} else {
  const existing = marketplace.plugins[existingIndex];
  const sameSource =
    existing?.source?.source === "local" &&
    existing?.source?.path === sourcePath;

  if (!sameSource && !force) {
    throw new Error(
      `${marketplacePath} already has ${pluginName} with source ${JSON.stringify(existing.source)}. Re-run with --force to replace it.`,
    );
  }

  marketplace.plugins[existingIndex] = {
    ...existing,
    ...entry,
    policy: {
      ...entry.policy,
      ...(existing.policy?.products ? { products: existing.policy.products } : {}),
    },
  };
  marketplaceStatus = sameSource ? "already-present" : "replaced";
}

writeJson(marketplacePath, marketplace);

console.log(`Codex plugin bundle: ${pluginRoot} (${bundleStatus})`);
console.log(`Marketplace entry: ${marketplacePath} (${marketplaceStatus})`);
console.log("Restart Codex to reload local marketplace plugins.");
