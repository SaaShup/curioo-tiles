import {
    describe,
    it,
    expect,
    beforeEach
} from "vitest";
import {
    createRequire
} from "node:module";

const require = createRequire(import.meta.url);

function loadAuth(env = {}) {
    const originalEnv = {
        ...process.env
    };

    delete process.env.ALLOWED_EDITOR_EMAILS;
    delete process.env.SESSION_SECRET;
    delete process.env.KEYCLOAK_SSL_REQUIRED;
    delete process.env.KEYCLOAK_CLIENT_ID;
    delete process.env.KEYCLOAK_CLIENT_SECRET;
    delete process.env.KEYCLOAK_CONFIDENTIAL_PORT;

    Object.assign(process.env, env);

    delete require.cache[require.resolve("../../lib/auth.js")];

    const auth = require("../../lib/auth.js");

    process.env = originalEnv;

    return auth;
}

function createReq(email) {
    if (!email) {
        return {};
    }

    return {
        kauth: {
            grant: {
                access_token: {
                    content: {
                        email,
                    },
                },
            },
        },
    };
}

function createRes() {
    return {
        statusCode: 200,
        body: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(data) {
            this.body = data;
            return this;
        },
    };
}

describe("auth", () => {
    beforeEach(() => {
        delete process.env.ALLOWED_EDITOR_EMAILS;
    });

    it("exports expected auth objects", () => {
        const auth = loadAuth();

        expect(auth.memoryStore).toBeDefined();
        expect(auth.sessionMiddleware).toBeDefined();
        expect(auth.keycloak).toBeDefined();
        expect(typeof auth.requireAllowedEditorEmail).toBe("function");
        expect(typeof auth.makeInitials).toBe("function");
    });

    it("makeInitials returns initials from full name", () => {
        const {
            makeInitials
        } = loadAuth();

        expect(makeInitials("Curioo City")).toBe("CC");
        expect(makeInitials("John Doe Smith")).toBe("JD");
    });

    it("makeInitials trims spaces", () => {
        const {
            makeInitials
        } = loadAuth();

        expect(makeInitials("   Alice   Bob   ")).toBe("AB");
    });

    it("makeInitials handles single word", () => {
        const {
            makeInitials
        } = loadAuth();

        expect(makeInitials("Curioo")).toBe("C");
    });

    it("makeInitials handles empty value", () => {
        const {
            makeInitials
        } = loadAuth();

        expect(makeInitials("")).toBe("U");
        expect(makeInitials(null)).toBe("U");
        expect(makeInitials(undefined)).toBe("U");
    });

    it("allows request when no ALLOWED_EDITOR_EMAILS is configured", () => {
        const {
            requireAllowedEditorEmail
        } = loadAuth();

        const req = createReq("user@example.com");
        const res = createRes();

        let nextCalled = false;

        requireAllowedEditorEmail(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(true);
        expect(res.statusCode).toBe(200);
    });

    it("allows request when allowed email list is empty", () => {
        const {
            requireAllowedEditorEmail
        } = loadAuth({
            ALLOWED_EDITOR_EMAILS: " , , ",
        });

        const req = createReq("user@example.com");
        const res = createRes();

        let nextCalled = false;

        requireAllowedEditorEmail(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(true);
    });

    it("allows request when user email is missing", () => {
        const {
            requireAllowedEditorEmail
        } = loadAuth({
            ALLOWED_EDITOR_EMAILS: "admin@example.com",
        });

        const req = {};
        const res = createRes();

        let nextCalled = false;

        requireAllowedEditorEmail(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(true);
    });

    it("allows request when email is in allow list", () => {
        const {
            requireAllowedEditorEmail
        } = loadAuth({
            ALLOWED_EDITOR_EMAILS: "admin@example.com, editor@example.com",
        });

        const req = createReq("EDITOR@example.com");
        const res = createRes();

        let nextCalled = false;

        requireAllowedEditorEmail(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(true);
    });

    it("rejects request when email is not allowed", () => {
        process.env.ALLOWED_EDITOR_EMAILS =
            "admin@example.com, editor@example.com";

        const {
            requireAllowedEditorEmail
        } = loadAuth();

        const req = createReq("hacker@example.com");
        const res = createRes();

        let nextCalled = false;

        requireAllowedEditorEmail(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(403);

        expect(res.body).toEqual({
            ok: false,
            error: "Email not allowed: hacker@example.com",
        });

        delete process.env.ALLOWED_EDITOR_EMAILS;
    });

    it("creates session middleware and keycloak with env values", () => {
        const auth = loadAuth({
            SESSION_SECRET: "secret123",
            KEYCLOAK_SSL_REQUIRED: "all",
            KEYCLOAK_CLIENT_ID: "tiles-app",
            KEYCLOAK_CLIENT_SECRET: "super-secret",
            KEYCLOAK_CONFIDENTIAL_PORT: "8443",
        });

        expect(auth.sessionMiddleware).toBeDefined();
        expect(auth.keycloak).toBeDefined();
    });

    it("allows request when allow list exists but user email is missing", () => {
        process.env.ALLOWED_EDITOR_EMAILS = "admin@example.com";

        const {
            requireAllowedEditorEmail
        } = loadAuth();

        const req = {};
        const res = createRes();

        let nextCalled = false;

        requireAllowedEditorEmail(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(true);
        expect(res.statusCode).toBe(200);

        delete process.env.ALLOWED_EDITOR_EMAILS;
    });

    it("allows request when email is explicitly allowed", () => {
        process.env.ALLOWED_EDITOR_EMAILS = "admin@example.com, editor@example.com";

        const {
            requireAllowedEditorEmail
        } = loadAuth();

        const req = createReq("EDITOR@example.com");
        const res = createRes();

        let nextCalled = false;

        requireAllowedEditorEmail(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(true);
        expect(res.statusCode).toBe(200);

        delete process.env.ALLOWED_EDITOR_EMAILS;
    });
});