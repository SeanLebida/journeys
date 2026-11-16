#!/usr/bin/env node
/**
 * Merge previously built hashed files from dist/assets into the new Vite
 * output so a tab left open after a deploy can still load last build's
 * chunks. Files drop out of the retain store 24 hours after they last
 * appeared in a Vite build.
 *
 * Usage:
 *   node retain-previous-assets.mjs --assets-dir dist/assets --retain-dir .web-asset-retain --ttl-hours 24
 */
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST_NAME = "manifest.json";

export function parseArgs(argv) {
  const out = { assetsDir: "dist/assets", retainDir: ".web-asset-retain", ttlHours: 24, now: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--assets-dir" && value) {
      out.assetsDir = value;
      i += 1;
    } else if (key === "--retain-dir" && value) {
      out.retainDir = value;
      i += 1;
    } else if (key === "--ttl-hours" && value) {
      out.ttlHours = Number(value);
      i += 1;
    } else if (key === "--now" && value) {
      out.now = Date.parse(value);
      i += 1;
    } else if (key === "--help" || key === "-h") {
      out.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${key}`);
    }
  }
  if (!Number.isFinite(out.ttlHours) || out.ttlHours < 0) {
    throw new Error(`Invalid --ttl-hours: ${out.ttlHours}`);
  }
  if (out.now !== undefined && !Number.isFinite(out.now)) {
    throw new Error("Invalid --now timestamp");
  }
  return out;
}

export function ttlMs(ttlHours) {
  return ttlHours * 60 * 60 * 1000;
}

async function readManifest(retainDir) {
  const manifestPath = path.join(retainDir, MANIFEST_NAME);
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.files && typeof parsed.files === "object"
      ? parsed
      : { files: {} };
  } catch (error) {
    if (error && error.code === "ENOENT") return { files: {} };
    throw error;
  }
}

async function listFilesRecursive(root) {
  const names = [];
  async function walk(dir, prefix) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile()) {
        names.push(rel);
      }
    }
  }
  await walk(root, "");
  return names;
}

export async function retainPreviousAssets({ assetsDir, retainDir, ttlHours, now = Date.now() }) {
  await mkdir(assetsDir, { recursive: true });
  await mkdir(retainDir, { recursive: true });

  const manifest = await readManifest(retainDir);
  const currentFiles = await listFilesRecursive(assetsDir);
  const currentSet = new Set(currentFiles);
  const cutoff = now - ttlMs(ttlHours);
  const restored = [];
  const pruned = [];
  const recorded = [];

  for (const file of currentFiles) {
    const from = path.join(assetsDir, file);
    const to = path.join(retainDir, "files", file);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { dereference: true });
    manifest.files[file] = { lastSeenInBuild: new Date(now).toISOString() };
    recorded.push(file);
  }

  for (const [file, meta] of Object.entries(manifest.files)) {
    if (currentSet.has(file)) continue;
    const lastSeen = Date.parse(meta?.lastSeenInBuild ?? "");
    const retainPath = path.join(retainDir, "files", file);
    if (!Number.isFinite(lastSeen) || lastSeen < cutoff) {
      delete manifest.files[file];
      await rm(retainPath, { force: true });
      pruned.push(file);
      continue;
    }
    try {
      await stat(retainPath);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        delete manifest.files[file];
        pruned.push(file);
        continue;
      }
      throw error;
    }
    const dest = path.join(assetsDir, file);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(retainPath, dest, { dereference: true });
    restored.push(file);
  }

  manifest.updatedAt = new Date(now).toISOString();
  manifest.ttlHours = ttlHours;
  await writeFile(path.join(retainDir, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);

  return { recorded, restored, pruned };
}

function summarize(result) {
  const line = (label, items) => `${label}: ${items.length}${items.length ? ` (${items.join(", ")})` : ""}`;
  return [
    line("kept from this build", result.recorded),
    line("restored from previous builds", result.restored),
    line("pruned", result.pruned),
  ].join("\n");
}

const isDirectRun = Boolean(process.argv[1] && path.basename(process.argv[1]) === "retain-previous-assets.mjs");
if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node retain-previous-assets.mjs --assets-dir dist/assets --retain-dir .web-asset-retain --ttl-hours 24");
    process.exit(0);
  }
  const result = await retainPreviousAssets({
    assetsDir: args.assetsDir,
    retainDir: args.retainDir,
    ttlHours: args.ttlHours,
    now: args.now,
  });
  console.log(summarize(result));
}
