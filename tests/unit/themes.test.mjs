import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

describe("themes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads themes from themes.json", async () => {
    const themes = {
      default: {
        background: [1, 2, 3, 255],
      },
    };

    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(themes)
    );

    const { loadThemes } = await import("../../lib/themes.js");

    expect(loadThemes()).toEqual(themes);

    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining("themes.json"),
      "utf8"
    );
  });

  it("saves themes to themes.json with pretty JSON", async () => {
    const themes = {
      forest: {
        water: [10, 20, 30, 255],
      },
    };

    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    const { saveThemes } = await import("../../lib/themes.js");

    saveThemes(themes);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("themes.json"),
      JSON.stringify(themes, null, 2)
    );
  });
});