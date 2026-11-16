import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { parseArgs, retainPreviousAssets } from "../retain-previous-assets.mjs";

async function tempRoot() {
  return mkdtemp(path.join(os.tmpdir(), "retain-assets-"));
}

describe("parseArgs", () => {
  it("reads directories and ttl", () => {
    const args = parseArgs([
      "--assets-dir",
      "dist/assets",
      "--retain-dir",
      ".web-asset-retain",
      "--ttl-hours",
      "24",
    ]);
    assert.equal(args.assetsDir, "dist/assets");
    assert.equal(args.retainDir, ".web-asset-retain");
    assert.equal(args.ttlHours, 24);
  });
});

describe("retainPreviousAssets", () => {
  it("restores a previous hashed file that is still within the ttl", async () => {
    const root = await tempRoot();
    const assetsDir = path.join(root, "assets");
    const retainDir = path.join(root, "retain");
    try {
      await mkdir(path.join(retainDir, "files"), { recursive: true });
      await mkdir(assetsDir, { recursive: true });
      await writeFile(path.join(retainDir, "files", "BibleMode-OLDHASH.js"), "old chunk");
      await writeFile(
        path.join(retainDir, "manifest.json"),
        JSON.stringify({ files: { "BibleMode-OLDHASH.js": { lastSeenInBuild: "2026-11-16T12:00:00.000Z" } } }),
      );
      await writeFile(path.join(assetsDir, "index-NEWHASH.js"), "new entry");

      const result = await retainPreviousAssets({
        assetsDir,
        retainDir,
        ttlHours: 24,
        now: Date.parse("2026-11-16T18:00:00.000Z"),
      });

      assert.deepEqual(result.restored, ["BibleMode-OLDHASH.js"]);
      assert.equal(await readFile(path.join(assetsDir, "BibleMode-OLDHASH.js"), "utf8"), "old chunk");
      assert.equal(await readFile(path.join(assetsDir, "index-NEWHASH.js"), "utf8"), "new entry");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prunes a previous file once it is older than the ttl", async () => {
    const root = await tempRoot();
    const assetsDir = path.join(root, "assets");
    const retainDir = path.join(root, "retain");
    try {
      await mkdir(path.join(retainDir, "files"), { recursive: true });
      await mkdir(assetsDir, { recursive: true });
      await writeFile(path.join(retainDir, "files", "BibleMode-OLDHASH.js"), "old chunk");
      await writeFile(
        path.join(retainDir, "manifest.json"),
        JSON.stringify({ files: { "BibleMode-OLDHASH.js": { lastSeenInBuild: "2026-11-15T10:00:00.000Z" } } }),
      );
      await writeFile(path.join(assetsDir, "index-NEWHASH.js"), "new entry");

      const result = await retainPreviousAssets({
        assetsDir,
        retainDir,
        ttlHours: 24,
        now: Date.parse("2026-11-16T18:00:00.000Z"),
      });

      assert.deepEqual(result.restored, []);
      assert.deepEqual(result.pruned, ["BibleMode-OLDHASH.js"]);
      await assert.rejects(readFile(path.join(assetsDir, "BibleMode-OLDHASH.js")), { code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
