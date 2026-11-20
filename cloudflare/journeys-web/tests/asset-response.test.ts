import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchAsset, isSpaFallback, missingAssetResponse } from "../src/index.ts";

describe("isSpaFallback", () => {
  it("treats HTML 200 as the SPA shell, not a real asset", () => {
    const response = new Response("<!doctype html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    assert.equal(isSpaFallback(response), true);
  });

  it("leaves real JS and CSS alone", () => {
    const js = new Response("export {}", {
      status: 200,
      headers: { "content-type": "text/javascript; charset=utf-8" },
    });
    const css = new Response("body{}", {
      status: 200,
      headers: { "content-type": "text/css" },
    });
    assert.equal(isSpaFallback(js), false);
    assert.equal(isSpaFallback(css), false);
  });

  it("does not reclassify an existing 404", () => {
    const response = new Response("missing", { status: 404, headers: { "content-type": "text/html" } });
    assert.equal(isSpaFallback(response), false);
  });
});

describe("fetchAsset", () => {
  it("returns a plain 404 when ASSETS serves the SPA shell", async () => {
    const env = {
      ASSETS: {
        fetch: async () =>
          new Response("<html>shell</html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      },
    };
    const response = await fetchAsset(new Request("https://example.com/app/assets/nope.js"), env);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /text\/plain/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "Not found");
  });

  it("passes through a real hashed file", async () => {
    const body = "export const ok = 1;";
    const env = {
      ASSETS: {
        fetch: async () =>
          new Response(body, {
            status: 200,
            headers: { "content-type": "text/javascript; charset=utf-8" },
          }),
      },
    };
    const response = await fetchAsset(new Request("https://example.com/app/assets/index-abc.js"), env);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), body);
  });
});

describe("missingAssetResponse", () => {
  it("is a 404 that must not be cached as HTML", () => {
    const response = missingAssetResponse();
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});
