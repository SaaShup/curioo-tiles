import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi
} from "vitest";
import {
    createRequire
} from "node:module";
import fs from "node:fs";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);

const overpass = require("../../lib/overpass.js");
const geo = require("../../lib/geo.js");
const config = require("../../lib/config.js");

const {
    fetchOverpass,
    getOverpassData,
    mergeOverpassData
} = overpass;
const {
    getZoneFromTile,
    getZonesFromTile,
    getCachePathForZone
} = geo;
const {
    CACHE_DIR,
    OVERPASS_URL
} = config;

const z = 18;
const x = 135540;
const y = 90176;

function cleanCache() {
    fs.rmSync(CACHE_DIR, {
        recursive: true,
        force: true
    });
}

describe("overpass", () => {
    beforeEach(() => {
        cleanCache();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        cleanCache();
        vi.restoreAllMocks();
    });

    it("fetchOverpass sends a POST request and parses JSON", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({
                elements: [{
                    id: 1,
                    type: "way"
                }],
            }),
        });

        const bbox = {
            latMin: 48.6,
            lonMin: 6.1,
            latMax: 48.7,
            lonMax: 6.2,
        };

        const data = await fetchOverpass(bbox);

        expect(data).toEqual({
            elements: [{
                id: 1,
                type: "way"
            }],
        });

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        const [url, options] = globalThis.fetch.mock.calls[0];

        expect(url).toBe(`${OVERPASS_URL}/api/interpreter`);
        expect(options.method).toBe("POST");
        expect(options.headers["Content-Type"]).toBe(
            "application/x-www-form-urlencoded"
        );
        expect(options.headers["User-Agent"]).toBe("CuriooCityTileServer/1.0");

        const body = options.body;
        expect(body.get("data")).toContain('[out:json][timeout:25]');
        expect(body.get("data")).toContain('way["natural"="water"]');
        expect(body.get("data")).toContain('way["highway"]');
    });

    it("fetchOverpass throws when Overpass returns an error", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => "Overpass failed",
        });

        await expect(
            fetchOverpass({
                latMin: 48.6,
                lonMin: 6.1,
                latMax: 48.7,
                lonMax: 6.2,
            })
        ).rejects.toThrow("Overpass error: 500");
    });

    it("getOverpassData reads from brotli cache when available", async () => {
        const zone = getZoneFromTile(z, x, y);
        const file = getCachePathForZone(zone);
        const brFile = `${file}.br`;

        fs.mkdirSync(CACHE_DIR, {
            recursive: true
        });

        const cachedData = {
            elements: [{
                id: 123,
                type: "way"
            }],
        };

        fs.writeFileSync(
            brFile,
            zlib.brotliCompressSync(Buffer.from(JSON.stringify(cachedData)))
        );

        globalThis.fetch = vi.fn();

        const data = await getOverpassData(z, x, y);

        expect(data).toEqual(cachedData);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("getOverpassData fetches data and writes brotli cache on miss", async () => {
        const responseData = {
            elements: [{
                id: 456,
                type: "way"
            }],
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify(responseData),
        });

        const data = await getOverpassData(z, x, y);

        expect(data).toEqual(responseData);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        const zone = getZoneFromTile(z, x, y);
        const file = getCachePathForZone(zone);
        const brFile = `${file}.br`;

        expect(fs.existsSync(brFile)).toBe(true);

        const cachedJson = zlib
            .brotliDecompressSync(fs.readFileSync(brFile))
            .toString("utf8");

        expect(JSON.parse(cachedJson)).toEqual(responseData);
    });

    it("getOverpassData fetches and merges every zone touched by a tile", async () => {
        const z16 = 16;
        const x16 = 33863;
        const y16 = 22544;
        const zones = getZonesFromTile(z16, x16, y16);
        const responses = zones.map((zone, index) => ({
            elements: [{
                id: index + 1,
                type: "way",
                zone: zone.lonMin.toFixed(2),
            }],
        }));

        globalThis.fetch = vi.fn().mockImplementation(async () => ({
            ok: true,
            text: async () => JSON.stringify(responses.shift()),
        }));

        const data = await getOverpassData(z16, x16, y16);

        expect(zones.length).toBeGreaterThan(1);
        expect(globalThis.fetch).toHaveBeenCalledTimes(zones.length);
        expect(data.elements).toHaveLength(zones.length);

        for (const zone of zones) {
            expect(fs.existsSync(`${getCachePathForZone(zone)}.br`)).toBe(true);
        }
    });

    it("mergeOverpassData removes duplicate OSM elements across zones", () => {
        expect(mergeOverpassData([
            {
                elements: [
                    { id: 1, type: "way", tags: { highway: "primary" } },
                    { id: 2, type: "way" },
                ],
            },
            {
                elements: [
                    { id: 1, type: "way", tags: { highway: "primary" } },
                    { id: 3, type: "node" },
                ],
            },
        ])).toEqual({
            elements: [
                { id: 1, type: "way", tags: { highway: "primary" } },
                { id: 2, type: "way" },
                { id: 3, type: "node" },
            ],
        });
    });

    it("getOverpassData saves empty cache when fetch fails", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            text: async () => "Service unavailable",
            });

            const promise = getOverpassData(z, x, y);

            await vi.advanceTimersByTimeAsync(1000);

            const data = await promise;

            expect(data).toEqual({ elements: [] });

            const zone = getZoneFromTile(z, x, y);
            const file = getCachePathForZone(zone);
            const brFile = `${file}.br`;

            expect(fs.existsSync(brFile)).toBe(true);

            const cachedJson = zlib
            .brotliDecompressSync(fs.readFileSync(brFile))
            .toString("utf8");

            expect(JSON.parse(cachedJson)).toEqual({ elements: [] });
        } finally {
            vi.useRealTimers();
        }
        });

    it("getOverpassData reuses pending request for same zone", async () => {
    vi.useFakeTimers();

    try {
        const responseData = {
        elements: [{ id: 789, type: "way" }],
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(responseData),
        });

        const firstPromise = getOverpassData(z, x, y);
        const secondPromise = getOverpassData(z, x, y);

        await vi.advanceTimersByTimeAsync(1000);

        const [first, second] = await Promise.all([
        firstPromise,
        secondPromise,
        ]);

        expect(first).toEqual(responseData);
        expect(second).toEqual(responseData);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
        vi.useRealTimers();
    }
    });
});
