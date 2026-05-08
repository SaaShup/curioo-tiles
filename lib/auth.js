const session = require("express-session");
const Keycloak = require("keycloak-connect");
const { KEYCLOAK_URL, KEYCLOAK_REALM } = require("./config");

const memoryStore = new session.MemoryStore();

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "curioocity",
  resave: false,
  saveUninitialized: true,
  store: memoryStore,
});

const keycloak = new Keycloak({ store: memoryStore }, {
  realm: KEYCLOAK_REALM,
  "auth-server-url": KEYCLOAK_URL,
  "ssl-required": process.env.KEYCLOAK_SSL_REQUIRED || "external",
  resource: process.env.KEYCLOAK_CLIENT_ID || "tilemap",
  credentials: {
    secret: process.env.KEYCLOAK_CLIENT_SECRET || "local",
  },
  "confidential-port": Number(process.env.KEYCLOAK_CONFIDENTIAL_PORT || 0),
});

function getAllowedEditorEmails() {
  return (process.env.ALLOWED_EDITOR_EMAILS || "lav@lvbh.xyz")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getLoggedUserEmail(req) {
  return req.kauth?.grant?.access_token?.content?.email?.toLowerCase();
}

function requireAllowedEditorEmail(req, res, next) {
  const allowedEmails = getAllowedEditorEmails();
  const userEmail = getLoggedUserEmail(req);

  if (!userEmail) {
    return res.status(403).json({ ok: false, error: "No email found in Keycloak token" });
  }

  if (!allowedEmails.includes(userEmail)) {
    return res.status(403).json({ ok: false, error: `Email not allowed: ${userEmail}` });
  }

  next();
}

function makeInitials(nameOrEmail) {
  const text = (nameOrEmail || "User").trim();
  return text
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

module.exports = {
  memoryStore,
  sessionMiddleware,
  keycloak,
  requireAllowedEditorEmail,
  makeInitials,
};
