let themes = {};
let currentTheme = "forest";
let previewMap;
let previewLayer;

function goToLocation() {
  const lat = Number(document.getElementById("latInput").value);
  const lon = Number(document.getElementById("lonInput").value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    document.getElementById("status").textContent = "Invalid latitude/longitude ❌";
    return;
  }
  localStorage.setItem("editor_lat", lat);
  localStorage.setItem("editor_lon", lon);
  previewMap.setView([lat, lon], 18);

  setTimeout(() => {
    previewMap.invalidateSize();
  }, 100);
}

document.getElementById("cacheToggle")?.addEventListener("change", () => {
  refreshPreviewMap();
});

function isCacheDisabled() {
  return document.getElementById("cacheToggle")?.checked ?? true;
}

function getThemeTileUrl(theme) {
  const cacheSuffix = isCacheDisabled() ? `?v=${Date.now()}` : "";

  if (theme === "default") {
    return `/18/{x}/{y}.png${cacheSuffix}`;
  }

  return `/${theme}/18/{x}/{y}.png${cacheSuffix}`;
}

function initPreviewMap() {
  previewMap = L.map("mapPreview", {
    center: [48.692, 6.184],
    zoom: 18,
    minZoom: 18,
    maxZoom: 18,
    zoomControl: true
  });

  previewLayer = L.tileLayer(getThemeTileUrl(currentTheme), {
    tileSize: 256,
    minZoom: 18,
    maxZoom: 18,
    maxNativeZoom: 18,
    attribution: "© CuriooCity"
  }).addTo(previewMap);
}

async function clearPreviewTheme(theme) {
  await fetch(`/api/preview-theme/${theme}`, {
    method: "DELETE"
  });
}

function refreshPreviewMap() {
  if (!previewMap) return;

  if (previewLayer) {
    previewMap.removeLayer(previewLayer);
  }

  previewLayer = L.tileLayer(getThemeTileUrl(currentTheme), {
    tileSize: 256,
    minZoom: 18,
    maxZoom: 18,
    maxNativeZoom: 18,
    attribution: "© CuriooCity"
  }).addTo(previewMap);

  setTimeout(() => previewMap.invalidateSize(), 100);
}

function rgbToHex(color) {
  const [r, g, b] = color;
  return "#" + [r, g, b]
    .map(v => Number(v).toString(16).padStart(2, "0"))
    .join("");
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function getAlpha(color) {
  return color?.[3] ?? 255;
}

async function loadThemes() {
  const res = await fetch("/api/themes");
  themes = await res.json();

  const select = document.getElementById("themeSelect");
  select.innerHTML = "";

  Object.keys(themes).forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  if (!themes[currentTheme]) {
    currentTheme = Object.keys(themes)[0];
  }

  select.value = currentTheme;
  await clearPreviewTheme(currentTheme);
  renderEditor();
}

function renderEditor() {
  currentTheme = document.getElementById("themeSelect").value;

  const theme = themes[currentTheme];
  const editor = document.getElementById("editor");

  editor.innerHTML = "";

  Object.entries(theme).forEach(([key, rgb]) => {
    const row = document.createElement("div");
    row.className = "color-row";

    const rgba = [
      rgb[0],
      rgb[1],
      rgb[2],
      getAlpha(rgb)
    ];

    row.innerHTML = `
          <label>${key}</label>

          <input type="color"
            value="${rgbToHex(rgba)}"
            data-key="${key}">

          <input type="range" min="0" max="255" value="${rgba[3]}" data-alpha-key="${key}" class="alpha-slider" >
        `;

    row.querySelector("input").addEventListener("input", e => {
      const newRgb = hexToRgb(e.target.value);

      row.querySelector(".rgb").textContent = [...newRgb, rgba[3]].join(", ");
    });

    editor.appendChild(row);
  });

  refreshPreviewMap();
}

function getEditorTheme() {
  const updated = {};

  document.querySelectorAll("input[type=color]").forEach(input => {
    const key = input.dataset.key;
    const alphaInput = document.querySelector(`[data-alpha-key="${key}"]`);

    updated[key] = [
      ...hexToRgb(input.value),
      Number(alphaInput?.value ?? 255)
    ];
  });

  return updated;
}

async function previewTheme() {
  const updated = getEditorTheme();

  themes[currentTheme] = updated;

  await fetch(`/api/preview-theme/${currentTheme}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updated)
  });

  refreshPreviewMap();

  document.getElementById("status").textContent = "Preview updated 👀";

  setTimeout(() => {
    document.getElementById("status").textContent = "";
  }, 1500);
}

async function saveTheme() {
  const updated = getEditorTheme();

  await fetch(`/api/themes/${currentTheme}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updated)
  });

  document.getElementById("status").textContent = "Theme saved ✅";

  await loadThemes();
  refreshPreviewMap();

  setTimeout(() => {
    document.getElementById("status").textContent = "";
  }, 2000);
}

document.getElementById("themeSelect").addEventListener("change", async () => {
  currentTheme = document.getElementById("themeSelect").value;
  await clearPreviewTheme(currentTheme);
  renderEditor();
});

loadThemes().then(() => {

  const savedLat = localStorage.getItem("editor_lat");
  const savedLon = localStorage.getItem("editor_lon");

  if (savedLat && savedLon) {
    document.getElementById("latInput").value = savedLat;
    document.getElementById("lonInput").value = savedLon;
  }

  initPreviewMap();

  if (savedLat && savedLon) {
    previewMap.setView(
      [Number(savedLat), Number(savedLon)],
      18
    );
  }
});

async function loadUser() {
  try {
    const res = await fetch("/api/me");
    const user = await res.json();

    const authBox = document.getElementById("authBox");

    if (!user.authenticated) {
      authBox.innerHTML = `
            <a href="/api/login" class="btn secondary login-btn">
              🔐 Login
            </a>
          `;
      return;
    }

    authBox.innerHTML = `
        <div class="userbox">
            <div class="avatar-fallback">
            ${user.initials || "U"}
            </div>

            <span class="username">
            ${user.name}
            </span>

            <a href="/api/logout" class="btn secondary">
            🚪 Logout
            </a>
        </div>
        `;
  } catch (err) {
    console.error(err);
  }
}

loadUser();