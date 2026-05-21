import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

function loadThemesModule() {
  delete require.cache[require.resolve("../../lib/config.js")];
  delete require.cache[require.resolve("../../lib/themes.js")];
  return require("../../lib/themes.js");
}

describe("themes", () => {
  let originalEnv;
  let tempDir;

  beforeEach(() => {
    originalEnv = { ...process.env };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tiles-themes-test-"));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads themes from defaults/themes.json", async () => {
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;
    const { DEFAULT_THEMES_FILE, loadThemes } = loadThemesModule();

    expect(loadThemes()).toEqual(
      JSON.parse(fs.readFileSync(DEFAULT_THEMES_FILE, "utf8"))
    );
  });

  it("saves themes to themes.json with pretty JSON", async () => {
    const themes = {
      forest: {
        water: [10, 20, 30, 255],
      },
    };

    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;
    const { saveThemes } = loadThemesModule();
    const writeFile = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    saveThemes(themes);

    expect(writeFile).toHaveBeenCalledWith(
      path.join(tempDir, "themes.json"),
      JSON.stringify(themes, null, 2)
    );
  });

  it("merges saved runtime themes over built-in default themes", async () => {
    const themes = {
      city: {
        grass: [1, 2, 3, 255],
      },
    };
    const runtimeThemesFile = path.join(tempDir, "themes.json");
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;
    fs.writeFileSync(runtimeThemesFile, JSON.stringify(themes));

    const { loadThemes } = loadThemesModule();
    const loadedThemes = loadThemes();

    expect(loadedThemes.forest).toBeDefined();
    expect(loadedThemes.space).toBeDefined();
    expect(loadedThemes.city.grass).toEqual([1, 2, 3, 255]);
    expect(loadedThemes.city.water).toEqual([80, 135, 170, 255]);
  });

  it("merges custom partial runtime themes over forest defaults", async () => {
    const themes = {
      custom: {
        grass: [1, 2, 3, 255],
      },
    };
    const runtimeThemesFile = path.join(tempDir, "themes.json");
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;
    fs.writeFileSync(runtimeThemesFile, JSON.stringify(themes));

    const { loadThemes } = loadThemesModule();
    const loadedThemes = loadThemes();

    expect(loadedThemes.custom.grass).toEqual([1, 2, 3, 255]);
    expect(loadedThemes.custom.water).toEqual(loadedThemes.forest.water);
  });

  it("merges with empty saved themes by default", async () => {
    const { mergeThemes } = loadThemesModule();
    const defaultThemes = {
      forest: {
        grass: [1, 2, 3, 255],
      },
    };

    expect(mergeThemes(defaultThemes)).toEqual(defaultThemes);
  });

  it("merges custom themes without forest fallback when no forest default exists", async () => {
    const { mergeThemes } = loadThemesModule();

    expect(
      mergeThemes(
        {
          city: {
            water: [1, 2, 3, 255],
          },
        },
        {
          custom: {
            grass: [4, 5, 6, 255],
          },
        }
      )
    ).toEqual({
      city: {
        water: [1, 2, 3, 255],
      },
      custom: {
        grass: [4, 5, 6, 255],
      },
    });
  });

  it("saves themes next to runtime-config.json in the runtime config directory", async () => {
    const themes = {
      city: {
        grass: [1, 2, 3, 255],
      },
    };
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;

    const { saveThemes } = loadThemesModule();

    saveThemes(themes);

    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, "themes.json"), "utf8"))
    ).toEqual(themes);
  });

  it("saves only the selected theme diff from defaults", async () => {
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;

    const { saveTheme } = loadThemesModule();

    saveTheme("city", {
      grass: [1, 2, 3, 255],
      darkGrass: [110, 110, 110, 255],
      lightGrass: [180, 180, 175, 255],
      water: [80, 135, 170, 255],
    });

    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, "themes.json"), "utf8"))
    ).toEqual({
      city: {
        grass: [1, 2, 3, 255],
      },
    });
  });

  it("preserves other saved themes when saving one selected theme", async () => {
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;
    fs.writeFileSync(
      path.join(tempDir, "themes.json"),
      JSON.stringify({
        space: {
          water: [9, 9, 9, 255],
        },
      })
    );

    const { saveTheme } = loadThemesModule();

    saveTheme("city", {
      grass: [1, 2, 3, 255],
      water: [80, 135, 170, 255],
    });

    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, "themes.json"), "utf8"))
    ).toEqual({
      space: {
        water: [9, 9, 9, 255],
      },
      city: {
        grass: [1, 2, 3, 255],
      },
    });
  });

  it("saves custom theme diffs from forest defaults", async () => {
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;

    const { saveTheme } = loadThemesModule();

    saveTheme("custom", {
      grass: [1, 2, 3, 255],
      water: [70, 145, 195, 255],
    });

    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, "themes.json"), "utf8"))
    ).toEqual({
      custom: {
        grass: [1, 2, 3, 255],
      },
    });
  });

  it("saves theme diffs without forest fallback when no forest default exists", async () => {
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;

    const themesModule = loadThemesModule();
    const { saveTheme } = themesModule;

    saveTheme("custom", {
      grass: [1, 2, 3, 255],
    });

    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, "themes.json"), "utf8"))
    ).toEqual({
      custom: {
        grass: [1, 2, 3, 255],
      },
    });
  });

  it("removes the selected saved theme when it matches defaults", async () => {
    process.env.TILE_RUNTIME_CONFIG_FILE = tempDir;
    fs.writeFileSync(
      path.join(tempDir, "themes.json"),
      JSON.stringify({
        city: {
          grass: [1, 2, 3, 255],
        },
        space: {
          water: [9, 9, 9, 255],
        },
      })
    );

    const { saveTheme } = loadThemesModule();

    saveTheme("city", {
      grass: [150, 150, 145, 255],
      water: [80, 135, 170, 255],
    });

    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, "themes.json"), "utf8"))
    ).toEqual({
      space: {
        water: [9, 9, 9, 255],
      },
    });
  });
});
