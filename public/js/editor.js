let themes = {};
let currentTheme = "forest";
let previewMap;
let previewLayer;
let isAuthenticated = false;
let currentApiKeys = "";
let apiKeysHidden = true;

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
    apiKeyHint.textContent = currentApiKeys
      ? `${keys.length} key${keys.length === 1 ? "" : "s"} configured`
      : "No keys configured";
    apiKeyRow.style.display = "flex";
  } catch (err) {
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
    const previewBtn = document.getElementById("previewBtn");
    const saveBtn = document.getElementById("saveBtn");
    const authHint = document.getElementById("authHint");

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
      if (authHint) authHint.style.display = "inline";
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
      const st = document.getElementById("status");
      if (st) st.textContent = "Log in to save themes 🔒";
      setTimeout(() => { if (st) st.textContent = ""; }, 1500);
      return;
    }
    saveTheme();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!isAuthenticated) {
      const st = document.getElementById("status");
      if (st) st.textContent = "Log in to preview themes 🔒";
      setTimeout(() => { if (st) st.textContent = ""; }, 1500);
      return;
    }
    previewTheme();
    return;
  }
});

loadUser();