const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const EDITOR_URL = `${BASE_URL}/editor`;

async function gotoHome(page) {
  await page.goto(BASE_URL);
}

async function gotoEditor(page) {
  await page.goto(EDITOR_URL);
}

module.exports = {
  BASE_URL,
  EDITOR_URL,
  gotoHome,
  gotoEditor,
};