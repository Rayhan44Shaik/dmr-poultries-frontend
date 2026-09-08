import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseMapsUrl, resolveLocationInput, GeoResolveError } from "./geoResolve.js";

describe("parseMapsUrl — deterministic, offline", () => {
  test("extracts place name + @lat,lng from /place/ URL", () => {
    const p = parseMapsUrl(
      "https://www.google.com/maps/place/P+V+P+Mall/@16.5109,80.6285,17z/data=!3m1!4b1"
    );
    assert.equal(p.placeName, "P V P Mall");
    assert.equal(p.latitude, 16.5109);
    assert.equal(p.longitude, 80.6285);
  });

  test("extracts !3d/!4d coordinates", () => {
    const p = parseMapsUrl(
      "https://maps.google.com/?q=P+V+P+Mall&ftid=0x0:0x0&entry=gps&ludocid=1#1!3d16.5109!4d80.6285"
    );
    assert.equal(p.placeName, "P V P Mall");
    assert.equal(p.latitude, 16.5109);
    assert.equal(p.longitude, 80.6285);
  });

  test("numeric q param is coordinates", () => {
    const p = parseMapsUrl("https://maps.google.com/?q=16.5109,80.6285");
    assert.equal(p.latitude, 16.5109);
    assert.equal(p.longitude, 80.6285);
    assert.equal(p.placeName, undefined);
  });

  test("text q param becomes place name", () => {
    const p = parseMapsUrl("https://maps.google.com/?q=P+V+P+Mall+Line%2C+Vijayawada");
    assert.equal(p.placeName, "P V P Mall Line, Vijayawada");
    assert.equal(p.latitude, undefined);
  });

  test("rejects out-of-range coordinates", () => {
    const p = parseMapsUrl("https://maps.google.com/?q=91,181");
    assert.equal(p.latitude, undefined);
    assert.equal(p.longitude, undefined);
  });

  test("share link without data parses to nothing (resolver must follow)", () => {
    const p = parseMapsUrl("https://maps.app.goo.gl/Wy1tBoCUgvUaYKST8");
    assert.equal(p.latitude, undefined);
    assert.equal(p.placeName, undefined);
  });

  test("non-URL input parses to nothing", () => {
    const p = parseMapsUrl("P V P MALL LINE, MOGHULRAJPURAM., Vijayawada 520010");
    assert.equal(p.latitude, undefined);
    assert.equal(p.placeName, undefined);
  });
});

describe("resolveLocationInput — validation & caching (no network needed)", () => {
  test("empty input rejects with actionable 422", async () => {
    await assert.rejects(() => resolveLocationInput("   "), (e: unknown) => {
      assert.ok(e instanceof GeoResolveError);
      assert.equal((e as GeoResolveError).status, 422);
      return true;
    });
  });

  test("off-allowlist host rejects without any network call", async () => {
    await assert.rejects(
      () => resolveLocationInput("https://evil.example.com/maps/@16.5,80.6"),
      (e: unknown) => e instanceof GeoResolveError
    );
  });

  test("URL with place name + coords resolves from URL alone (name wins)", async () => {
    const r = await resolveLocationInput(
      "https://www.google.com/maps/place/P+V+P+Mall/@16.5109,80.6285,17z/"
    );
    assert.equal(r.latitude, 16.5109);
    assert.equal(r.longitude, 80.6285);
    assert.equal(r.address, "P V P Mall");
  });

  test("identical in-flight/repeat input is de-duplicated and cached", async () => {
    const url = "https://www.google.com/maps/place/Cached+Spot/@17.385,78.485,15z/";
    const [a, b] = await Promise.all([resolveLocationInput(url), resolveLocationInput(url)]);
    assert.equal(a, b); // same cached promise result object
    const c = await resolveLocationInput(url);
    assert.equal(c.address, "Cached Spot");
  });

  test("plain 'lat, lng' text resolves; reverse geocode failure is tolerated", async () => {
    // Sandbox/offline: reverse geocode may fail — address may be null but the
    // coordinates must come back so the shop can still be saved.
    const r = await resolveLocationInput("16.5109, 80.6285");
    assert.equal(r.latitude, 16.5109);
    assert.equal(r.longitude, 80.6285);
    assert.ok(r.address === null || typeof r.address === "string");
  });
});
