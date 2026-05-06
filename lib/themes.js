const fs = require("fs");
const path = require("path");

const THEMES_FILE = path.join(__dirname, "themes.json");

function loadThemes() {
  return JSON.parse(fs.readFileSync(THEMES_FILE, "utf8"));
}

function saveThemes(themes) {
  fs.writeFileSync(THEMES_FILE, JSON.stringify(themes, null, 2));
}

module.exports = {
  loadThemes,
  saveThemes,
};