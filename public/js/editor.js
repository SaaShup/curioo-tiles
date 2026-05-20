let themes = {};
let currentTheme = "forest";
let previewMap;
let previewLayer;
let isAuthenticated = false;
let currentApiKeys = "";
let apiKeysHidden = true;
let currentPreviewToken = null;
let tileZoomRange = [18, 18];

function getMinTileZoom() {
  return tileZoomRange[0];
}

function getMaxTileZoom() {
  return tileZoomRange[1];
}

function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
  }, 10);

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

function goToLocation() {
  const lat = Number(document.getElementById("latInput").value);
  const lon = Number(document.getElementById("lonInput").value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    showNotification("Invalid latitude/longitude ❌", "error");
    return;
  }
  showNotification("Map moved 📍");
  localStorage.setItem("editor_lat", lat);
  localStorage.setItem("editor_lon", lon);
  previewMap.setView([lat, lon], getMaxTileZoom());

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
  const params = new URLSearchParams();

  if (currentApiKeys) {
    const firstKey = currentApiKeys.split(",")[0].trim();

    if (firstKey) {
      params.set("key", firstKey);
    }
  }

  if (isCacheDisabled()) {
    params.set("v", Date.now());
  } else if (currentPreviewToken) {
    params.set("preview", currentPreviewToken);
  }

  const query = params.toString()
    ? `?${params.toString()}`
    : "";

  if (theme === "default") {
    return `/{z}/{x}/{y}.png${query}`;
  }

  return `/${theme}/{z}/{x}/{y}.png${query}`;
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;

    const config = await res.json();
    if (
      Array.isArray(config.tileZoomRange) &&
      config.tileZoomRange.length === 2 &&
      Number.isInteger(config.tileZoomRange[0]) &&
      Number.isInteger(config.tileZoomRange[1]) &&
      config.tileZoomRange[0] >= 3 &&
      config.tileZoomRange[1] <= 20 &&
      config.tileZoomRange[1] >= config.tileZoomRange[0]
    ) {
      tileZoomRange = config.tileZoomRange;
    }
  } catch (err) {
    console.error("Failed to load config:", err);
  }
}

async function loadApiKeys() {
  const apiKeyRow = document.getElementById("apiKeyRow");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const apiKeyHint = document.getElementById("apiKeyHint");
  const toggleButton = document.getElementById("toggleApiKeyBtn");

  if (!apiKeyRow || !apiKeyInput || !toggleButton) {
    return;
  }

  try {
    const res = await fetch("/api/tile-api-keys");
    if (!res.ok) {
      apiKeyInput.value = "";
      apiKeyHint.textContent = "Unable to load keys";
      apiKeyRow.style.display = "flex";
      return;
    }

    const { keys = [] } = await res.json();
    currentApiKeys = Array.isArray(keys) ? keys.join(", ") : "";
    apiKeysHidden = true;
    apiKeyInput.value = currentApiKeys ? "*".repeat(currentApiKeys.length) : "";
    apiKeyInput.placeholder = currentApiKeys ? "" : "***********";
    apiKeyInput.readOnly = true;
    toggleButton.textContent = "Show";
    let apiKeyMessage;
    if (currentApiKeys) {
      const suffix = keys.length === 1 ? "" : "s";
      apiKeyMessage = `${keys.length} key${suffix} configured`;
    } else {
      apiKeyMessage = "No keys configured";
    }
    apiKeyHint.textContent = apiKeyMessage;
    apiKeyRow.style.display = "flex";
  } catch (err) {
    console.error("Failed to load API keys:", err);
    currentApiKeys = "";
    apiKeysHidden = true;
    apiKeyInput.value = "";
    apiKeyInput.placeholder = "***********";
    apiKeyInput.readOnly = true;
    toggleButton.textContent = "Show";
    apiKeyHint.textContent = "Unable to load keys";
    apiKeyRow.style.display = "flex";
  }
}

function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById("apiKeyInput");
  const toggleButton = document.getElementById("toggleApiKeyBtn");

  if (!apiKeyInput || !toggleButton) {
    return;
  }

  apiKeysHidden = !apiKeysHidden;
  if (apiKeysHidden) {
    apiKeyInput.value = currentApiKeys ? "*".repeat(currentApiKeys.length) : "";
    apiKeyInput.placeholder = currentApiKeys ? "" : "***********";
    toggleButton.textContent = "Show";
  } else {
    apiKeyInput.value = currentApiKeys;
    apiKeyInput.placeholder = "";
    toggleButton.textContent = "Hide";
  }
}

function initPreviewMap() {
  previewMap = L.map("mapPreview", {
    center: [48.692, 6.184],
    zoom: getMaxTileZoom(),
    minZoom: getMinTileZoom(),
    maxZoom: getMaxTileZoom(),
    zoomControl: true,
    fullscreenControl: true
  });

  previewLayer = L.tileLayer(getThemeTileUrl(currentTheme), {
    tileSize: 256,
    minZoom: getMinTileZoom(),
    maxZoom: getMaxTileZoom(),
    maxNativeZoom: getMaxTileZoom(),
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
    minZoom: getMinTileZoom(),
    maxZoom: getMaxTileZoom(),
    maxNativeZoom: getMaxTileZoom(),
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
  const n = Number.parseInt(hex.slice(1), 16);
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

          <span class="rgb">${rgba.join(", ")}</span>
        `;

    const colorInput = row.querySelector("input[type=color]");
    const alphaInput = row.querySelector("input[type=range]");
    const rgbLabel = row.querySelector(".rgb");

    function updateRgbText(newAlpha = rgba[3]) {
      if (!colorInput || !rgbLabel) return;
      const newRgb = hexToRgb(colorInput.value);
      rgbLabel.textContent = [...newRgb, Number(newAlpha)].join(", ");
    }

    if (colorInput) {
      colorInput.addEventListener("input", () => {
        updateRgbText(alphaInput?.value ?? rgba[3]);
      });
    }

    if (alphaInput) {
      alphaInput.addEventListener("input", () => {
        updateRgbText(alphaInput.value);
      });
    }

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

  if (Object.keys(updated).length === 0 && themes[currentTheme]) {
    const copy = {};
    Object.entries(themes[currentTheme]).forEach(([k, v]) => {
      copy[k] = Array.isArray(v) ? [...v] : v;
    });
    return copy;
  }

  return updated;
}

async function waitForEditorInputs(timeout = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (document.querySelectorAll("input[type=color]").length > 0) return;
    await new Promise(r => setTimeout(r, 50));
  }
}

async function previewTheme() {
  let updated = getEditorTheme();

  if (Object.keys(updated).length === 0) {
    await waitForEditorInputs(500);
    updated = getEditorTheme();
  }

  const payload = Object.keys(updated).length === 0 && themes[currentTheme]
    ? themes[currentTheme]
    : updated;

  themes[currentTheme] = payload;
  currentPreviewToken = Date.now();

  await fetch(`/api/preview-theme/${currentTheme}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  refreshPreviewMap();
  showNotification("Preview updated 👀");
}

async function saveTheme() {
  let updated = getEditorTheme();

  if (Object.keys(updated).length === 0) {
    await waitForEditorInputs(500);
    updated = getEditorTheme();
  }

  const payload = Object.keys(updated).length === 0 && themes[currentTheme]
    ? themes[currentTheme]
    : updated;

  await fetch(`/api/themes/${currentTheme}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  showNotification("Theme saved ✅");

  await loadThemes();
  refreshPreviewMap();
}

document.getElementById("themeSelect").addEventListener("change", async () => {
  currentTheme = document.getElementById("themeSelect").value;
  await clearPreviewTheme(currentTheme);
  renderEditor();
});

async function initEditor() {
  await loadConfig();
  await loadUser();
  await loadThemes();

  const savedLat = localStorage.getItem("editor_lat");
  const savedLon = localStorage.getItem("editor_lon");

  if (savedLat && savedLon) {
    document.getElementById("latInput").value = savedLat;
    document.getElementById("lonInput").value = savedLon;
  }

  initPreviewMap();

  if (savedLat && savedLon) {
    previewMap.setView([Number(savedLat), Number(savedLon)], getMaxTileZoom());
  }
}

async function loadUser() {
  try {
    const res = await fetch("/api/me");
    const user = await res.json();

    const authBox = document.getElementById("authBox");
    const previewBtn = document.getElementById("previewBtn");
    const saveBtn = document.getElementById("saveBtn");
    const authHint = document.getElementById("authHint");
    const cacheToggleLabel = document.querySelector(".cache-toggle");

    if (!user.authenticated) {
      authBox.innerHTML = "";
      const loginLink = document.createElement("a");
      loginLink.href = "/api/login";
      loginLink.className = "btn secondary login-btn";
      loginLink.textContent = "🔐 Login";
      authBox.appendChild(loginLink);
      isAuthenticated = false;
      if (previewBtn) previewBtn.style.display = "none";
      if (saveBtn) saveBtn.style.display = "none";
      if (authHint) authHint.style.display = "inline-flex";
      if (cacheToggleLabel) cacheToggleLabel.style.display = "none";
      return;
    }

    authBox.innerHTML = "";
    const userbox = document.createElement("div");
    userbox.className = "userbox";

    const avatar = document.createElement("div");
    avatar.className = "avatar-fallback";
    avatar.textContent = user.initials || "U";

    const username = document.createElement("span");
    username.className = "username";
    username.textContent = user.name;

    const logoutLink = document.createElement("a");
    logoutLink.href = "/api/logout";
    logoutLink.className = "btn secondary";
    logoutLink.textContent = "🚪 Logout";

    userbox.appendChild(avatar);
    userbox.appendChild(username);
    userbox.appendChild(logoutLink);

    authBox.appendChild(userbox);
    isAuthenticated = true;
    if (previewBtn) previewBtn.style.display = "";
    if (saveBtn) saveBtn.style.display = "";
    if (authHint) authHint.style.display = "none";
    if (cacheToggleLabel) cacheToggleLabel.style.display = "";
    await loadApiKeys();
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("toggleApiKeyBtn")?.addEventListener("click", toggleApiKeyVisibility);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (!isAuthenticated) {
      showNotification("Log in to save themes 🔒");
      return;
    }
    saveTheme();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!isAuthenticated) {
      showNotification("Log in to preview themes 🔒");
      return;
    }
    previewTheme();
  }
});

let pickersHidden = true;

function togglePickers() {
  const editor = document.getElementById("editor");
  const button = document.getElementById("togglePickersBtn");

  const hidden = editor.style.display === "none";

  editor.style.display = hidden ? "grid" : "none";

  button.textContent = hidden
    ? "Hide pickers"
    : "Show pickers";
}

document
  .getElementById("togglePickersBtn")
  ?.addEventListener("click", togglePickers);

initEditor();
