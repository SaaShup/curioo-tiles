  const THEME_STORAGE_KEY = "tile_color_scheme";

  function getPreferredColorScheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }

    return matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyColorScheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;

    document.querySelectorAll(".theme-toggle").forEach((button) => {
      const isDark = nextTheme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute(
        "aria-label",
        `Switch to ${isDark ? "light" : "dark"} mode`
      );

      const icon = button.querySelector(".theme-toggle-icon");
      const label = button.querySelector(".theme-toggle-label");

      if (icon) {
        icon.textContent = isDark ? "☀" : "☾";
      }

      if (label) {
        label.textContent = isDark ? "Light" : "Dark";
      }
    });
  }

  function toggleColorScheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark";

    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyColorScheme(nextTheme);
  }

  function initColorScheme() {
    applyColorScheme(getPreferredColorScheme());

    document.querySelectorAll(".theme-toggle").forEach((button) => {
      button.addEventListener("click", toggleColorScheme);
    });
  }

  async function loadVersion() {
    try {
      const res = await fetch("/api/version");
      const data = await res.json();

      document.getElementById("version").textContent =
        "v" + data.version;
    } catch (err) {
      console.error(err);

      document.getElementById("version").textContent =
        "version unavailable";
    }
  }

  initColorScheme();
  loadVersion();
