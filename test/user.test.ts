// test/user.test.ts

import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { api, seed, cleanup, type SeededData } from "./setup";

let s: SeededData;

beforeAll(async () => {
    s = await seed();
});

afterAll(async () => {
    await cleanup();
});

// ═════════════════════════════════════════════════════════════
//  GET /v1/users/me — Account
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me");
        expect(res.status).toBe(401);
    });

    it("returns account info for authenticated user", async () => {
        const res = await api.get("/v1/users/me", { token: s.users.user.token });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.id).toBe(s.users.user.id);
        expect(body.data.username).toBe(s.users.user.username);
        expect(body.data.email).toBe(s.users.user.email);
        expect(body.data).toHaveProperty("role");
        expect(body.data).toHaveProperty("createdAt");
    });

    it("does not leak passwordHash", async () => {
        const res = await api.get("/v1/users/me", { token: s.users.user.token });
        const body = await res.json();
        expect(body.data).not.toHaveProperty("passwordHash");
    });
});

// ═════════════════════════════════════════════════════════════
//  Profile
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me/profile", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/profile");
        expect(res.status).toBe(401);
    });

    it("returns profile for authenticated user", async () => {
        const res = await api.get("/v1/users/me/profile", { token: s.users.user.token });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.userId).toBe(s.users.user.id);
    });
});

describe("PATCH /v1/users/me/profile", () => {
    it("returns 401 without auth", async () => {
        const res = await api.patch("/v1/users/me/profile", {
            body: { firstName: "Test" },
        });
        expect(res.status).toBe(401);
    });

    it("updates firstName", async () => {
        const res = await api.patch("/v1/users/me/profile", {
            token: s.users.user.token,
            body: { firstName: "Updated" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.firstName).toBe("Updated");
    });

    it("updates multiple fields at once", async () => {
        const res = await api.patch("/v1/users/me/profile", {
            token: s.users.user.token,
            body: { bio: "Hello world", gender: "Other" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.bio).toBe("Hello world");
        expect(body.data.gender).toBe("Other");
    });

    it("updates socialMedia as JSON", async () => {
        const res = await api.patch("/v1/users/me/profile", {
            token: s.users.user.token,
            body: { socialMedia: { twitter: "https://x.com/test" } },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.socialMedia.twitter).toBe("https://x.com/test");
    });

    it("rejects empty update", async () => {
        const res = await api.patch("/v1/users/me/profile", {
            token: s.users.user.token,
            body: {},
        });
        expect(res.status).toBe(400);
    });

    it("ignores unknown fields", async () => {
        const res = await api.patch("/v1/users/me/profile", {
            token: s.users.user.token,
            body: { firstName: "Still Valid", hackerField: "drop table" },
        });
        // sanitizeUpdates strips unknown fields, so if firstName is the only valid one it should work
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.firstName).toBe("Still Valid");
        expect(body.data).not.toHaveProperty("hackerField");
    });
});

// ═════════════════════════════════════════════════════════════
//  Preferences
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me/preferences", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/preferences");
        expect(res.status).toBe(401);
    });

    it("returns preferences", async () => {
        const res = await api.get("/v1/users/me/preferences", { token: s.users.user.token });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.userId).toBe(s.users.user.id);
        expect(body.data).toHaveProperty("theme");
    });
});

describe("PATCH /v1/users/me/preferences", () => {
    it("returns 401 without auth", async () => {
        const res = await api.patch("/v1/users/me/preferences", {
            body: { theme: "dark" },
        });
        expect(res.status).toBe(401);
    });

    it("updates theme", async () => {
        const res = await api.patch("/v1/users/me/preferences", {
            token: s.users.user.token,
            body: { theme: "dark" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.theme).toBe("dark");
    });

    it("updates privacy settings", async () => {
        const res = await api.patch("/v1/users/me/preferences", {
            token: s.users.user.token,
            body: { privacyAge: "public", privacyGender: "friends" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.privacyAge).toBe("public");
        expect(body.data.privacyGender).toBe("friends");
    });

    it("rejects invalid theme value", async () => {
        const res = await api.patch("/v1/users/me/preferences", {
            token: s.users.user.token,
            body: { theme: "neon" },
        });
        expect(res.status).toBe(400);
    });

    it("rejects empty update", async () => {
        const res = await api.patch("/v1/users/me/preferences", {
            token: s.users.user.token,
            body: {},
        });
        expect(res.status).toBe(400);
    });
});

// ═════════════════════════════════════════════════════════════
//  Notification Settings
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me/notification-settings", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/notification-settings");
        expect(res.status).toBe(401);
    });

    it("returns notification settings", async () => {
        const res = await api.get("/v1/users/me/notification-settings", {
            token: s.users.user.token,
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.userId).toBe(s.users.user.id);
        expect(body.data).toHaveProperty("notifyFollower");
    });
});

describe("PATCH /v1/users/me/notification-settings", () => {
    it("returns 401 without auth", async () => {
        const res = await api.patch("/v1/users/me/notification-settings", {
            body: { notifyFollower: false },
        });
        expect(res.status).toBe(401);
    });

    it("updates a single setting", async () => {
        const res = await api.patch("/v1/users/me/notification-settings", {
            token: s.users.user.token,
            body: { notifyFollower: false },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.notifyFollower).toBe(false);
    });

    it("updates multiple settings", async () => {
        const res = await api.patch("/v1/users/me/notification-settings", {
            token: s.users.user.token,
            body: { notifyWeekly: false, notifyUpdates: false },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.notifyWeekly).toBe(false);
        expect(body.data.notifyUpdates).toBe(false);
    });

    it("rejects empty update", async () => {
        const res = await api.patch("/v1/users/me/notification-settings", {
            token: s.users.user.token,
            body: {},
        });
        expect(res.status).toBe(400);
    });
});

// ═════════════════════════════════════════════════════════════
//  Social Auths
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me/social-auths", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/social-auths");
        expect(res.status).toBe(401);
    });

    it("returns linked providers (may be empty for test users)", async () => {
        const res = await api.get("/v1/users/me/social-auths", {
            token: s.users.user.token,
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
    });
});

describe("DELETE /v1/users/me/social-auths/:provider", () => {
    it("returns 401 without auth", async () => {
        const res = await api.delete("/v1/users/me/social-auths/google");
        expect(res.status).toBe(401);
    });

    it("returns 404 when provider is not linked", async () => {
        const res = await api.delete("/v1/users/me/social-auths/google", {
            token: s.users.user.token,
        });
        // User has a password and no linked google, so either 404 (not linked) or 400
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  Interests
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me/interests", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/interests");
        expect(res.status).toBe(401);
    });

    it("returns seeded interests", async () => {
        const res = await api.get("/v1/users/me/interests", {
            token: s.users.user.token,
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.data.length).toBeGreaterThanOrEqual(2);
    });
});

describe("POST /v1/users/me/interests", () => {
    it("returns 401 without auth", async () => {
        const res = await api.post("/v1/users/me/interests", {
            body: { interest: "Robotics" },
        });
        expect(res.status).toBe(401);
    });

    it("creates an interest", async () => {
        const res = await api.post("/v1/users/me/interests", {
            token: s.users.user.token,
            body: { interest: "Quantum Computing", isPrimary: false },
        });
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.data.interest).toBe("Quantum Computing");
        expect(body.data.isPrimary).toBe(false);
        expect(body.data.id).toBeNumber();
    });

    it("validates missing interest field", async () => {
        const res = await api.post("/v1/users/me/interests", {
            token: s.users.user.token,
            body: {},
        });
        expect(res.status).toBe(400);
    });
});

describe("PATCH /v1/users/me/interests/:id", () => {
    it("updates an interest", async () => {
        const interestId = s.interests[0].id;
        const res = await api.patch(`/v1/users/me/interests/${interestId}`, {
            token: s.users.user.token,
            body: { isPrimary: false },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.isPrimary).toBe(false);
    });

    it("returns 404 for another user's interest", async () => {
        // editor's interest — user should not be able to update it
        const editorInterestId = s.interests[2].id;
        const res = await api.patch(`/v1/users/me/interests/${editorInterestId}`, {
            token: s.users.user.token,
            body: { isPrimary: true },
        });
        expect(res.status).toBe(404);
    });

    it("returns 400 for empty update", async () => {
        const interestId = s.interests[0].id;
        const res = await api.patch(`/v1/users/me/interests/${interestId}`, {
            token: s.users.user.token,
            body: {},
        });
        expect(res.status).toBe(400);
    });
});

describe("DELETE /v1/users/me/interests/:id", () => {
    it("returns 401 without auth", async () => {
        const res = await api.delete(`/v1/users/me/interests/${s.interests[0].id}`);
        expect(res.status).toBe(401);
    });

    it("deletes own interest", async () => {
        // Create a throwaway interest to delete
        const created = await api.post("/v1/users/me/interests", {
            token: s.users.user.token,
            body: { interest: "Disposable Interest" },
        });
        const { id } = (await created.json()).data;

        const res = await api.delete(`/v1/users/me/interests/${id}`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(204);
    });

    it("returns 404 for another user's interest", async () => {
        const editorInterestId = s.interests[2].id;
        const res = await api.delete(`/v1/users/me/interests/${editorInterestId}`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent interest", async () => {
        const res = await api.delete("/v1/users/me/interests/999999", {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  Education
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me/education", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/education");
        expect(res.status).toBe(401);
    });

    it("returns seeded education entries", async () => {
        const res = await api.get("/v1/users/me/education", {
            token: s.users.user.token,
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.data.length).toBeGreaterThanOrEqual(2);
    });
});

describe("POST /v1/users/me/education", () => {
    it("returns 401 without auth", async () => {
        const res = await api.post("/v1/users/me/education", {
            body: { educationalBackground: "BSc Physics" },
        });
        expect(res.status).toBe(401);
    });

    it("creates an education entry", async () => {
        const res = await api.post("/v1/users/me/education", {
            token: s.users.user.token,
            body: { educationalBackground: "PhD Machine Learning" },
        });
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.data.educationalBackground).toBe("PhD Machine Learning");
        expect(body.data.id).toBeNumber();
    });

    it("validates missing educationalBackground", async () => {
        const res = await api.post("/v1/users/me/education", {
            token: s.users.user.token,
            body: {},
        });
        expect(res.status).toBe(400);
    });
});

describe("PATCH /v1/users/me/education/:id", () => {
    it("updates an education entry", async () => {
        const eduId = s.education[0].id;
        const res = await api.patch(`/v1/users/me/education/${eduId}`, {
            token: s.users.user.token,
            body: { educationalBackground: "MSc AI" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.educationalBackground).toBe("MSc AI");
    });

    it("returns 404 for another user's education", async () => {
        const editorEduId = s.education[2].id;
        const res = await api.patch(`/v1/users/me/education/${editorEduId}`, {
            token: s.users.user.token,
            body: { educationalBackground: "Hacked" },
        });
        expect(res.status).toBe(404);
    });
});

describe("DELETE /v1/users/me/education/:id", () => {
    it("deletes own education entry", async () => {
        const created = await api.post("/v1/users/me/education", {
            token: s.users.user.token,
            body: { educationalBackground: "Disposable Degree" },
        });
        const { id } = (await created.json()).data;

        const res = await api.delete(`/v1/users/me/education/${id}`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(204);
    });

    it("returns 404 for another user's education", async () => {
        const editorEduId = s.education[2].id;
        const res = await api.delete(`/v1/users/me/education/${editorEduId}`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  Wallets
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me/wallets", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/wallets");
        expect(res.status).toBe(401);
    });

    it("returns seeded wallets", async () => {
        const res = await api.get("/v1/users/me/wallets", {
            token: s.users.user.token,
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
});

describe("POST /v1/users/me/wallets", () => {
    it("returns 401 without auth", async () => {
        const res = await api.post("/v1/users/me/wallets", {
            body: { publicAddress: "0xnew123" },
        });
        expect(res.status).toBe(401);
    });

    it("connects a new wallet", async () => {
        const res = await api.post("/v1/users/me/wallets", {
            token: s.users.user.token,
            body: { publicAddress: "0xtest-new-wallet-456" },
        });
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.data.publicAddress).toBe("0xtest-new-wallet-456");
        expect(body.data.isVerified).toBe(false);
    });

    it("rejects duplicate wallet address", async () => {
        const res = await api.post("/v1/users/me/wallets", {
            token: s.users.user.token,
            body: { publicAddress: s.wallets[0].publicAddress },
        });
        expect(res.status).toBe(409);
    });
});

describe("PATCH /v1/users/me/wallets/:id", () => {
    it("updates payment address", async () => {
        const walletId = s.wallets[0].id;
        const res = await api.patch(`/v1/users/me/wallets/${walletId}`, {
            token: s.users.user.token,
            body: { paymentAddress: "0xpayment-addr" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.paymentAddress).toBe("0xpayment-addr");
    });

    it("returns 404 for non-existent wallet", async () => {
        const res = await api.patch("/v1/users/me/wallets/999999", {
            token: s.users.user.token,
            body: { paymentAddress: "0x" },
        });
        expect(res.status).toBe(404);
    });
});

describe("DELETE /v1/users/me/wallets/:id", () => {
    it("disconnects a wallet", async () => {
        // Create a throwaway wallet to delete
        const created = await api.post("/v1/users/me/wallets", {
            token: s.users.user.token,
            body: { publicAddress: "0xdisposable-wallet-789" },
        });
        const { id } = (await created.json()).data;

        const res = await api.delete(`/v1/users/me/wallets/${id}`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(204);
    });

    it("returns 404 for non-existent wallet", async () => {
        const res = await api.delete("/v1/users/me/wallets/999999", {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  Friend Requests
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/me/friend-requests", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/friend-requests");
        expect(res.status).toBe(401);
    });

    it("returns received friend requests", async () => {
        // user has 2 received requests (from editor and admin)
        const res = await api.get("/v1/users/me/friend-requests", {
            token: s.users.user.token,
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    it("includes requester info", async () => {
        const res = await api.get("/v1/users/me/friend-requests", {
            token: s.users.user.token,
        });
        const body = await res.json();
        const first = body.data[0];
        expect(first).toHaveProperty("requester");
        expect(first.requester).toHaveProperty("username");
    });
});

describe("GET /v1/users/me/friend-requests/sent", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users/me/friend-requests/sent");
        expect(res.status).toBe(401);
    });

    it("returns sent friend requests for editor", async () => {
        // editor sent a request to user
        const res = await api.get("/v1/users/me/friend-requests/sent", {
            token: s.users.editor.token,
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
});

describe("PATCH /v1/users/me/friend-requests/:id — respond", () => {
    it("returns 401 without auth", async () => {
        const requestId = s.friendRequests[0].id;
        const res = await api.patch(`/v1/users/me/friend-requests/${requestId}`, {
            body: { status: "accepted" },
        });
        expect(res.status).toBe(401);
    });

    it("accepts a pending friend request", async () => {
        // friendRequests[0] is editor → user, status "pending"
        const requestId = s.friendRequests[0].id;
        const res = await api.patch(`/v1/users/me/friend-requests/${requestId}`, {
            token: s.users.user.token,
            body: { status: "accepted" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.status).toBe("accepted");
        expect(body.data.decidedAt).toBeTruthy();
    });

    it("rejects responding to an already-decided request", async () => {
        const requestId = s.friendRequests[0].id;
        const res = await api.patch(`/v1/users/me/friend-requests/${requestId}`, {
            token: s.users.user.token,
            body: { status: "rejected" },
        });
        expect(res.status).toBe(400);
    });

    it("returns 404 for request not addressed to this user", async () => {
        // friendRequests[0] is addressed to user — editor should not be able to respond
        const requestId = s.friendRequests[0].id;
        const res = await api.patch(`/v1/users/me/friend-requests/${requestId}`, {
            token: s.users.editor.token,
            body: { status: "accepted" },
        });
        expect(res.status).toBe(404);
    });

    it("validates status value", async () => {
        const res = await api.patch(`/v1/users/me/friend-requests/${s.friendRequests[0].id}`, {
            token: s.users.user.token,
            body: { status: "maybe" },
        });
        expect(res.status).toBe(400);
    });
});

describe("DELETE /v1/users/me/friend-requests/:id — cancel", () => {
    it("returns 401 without auth", async () => {
        const res = await api.delete("/v1/users/me/friend-requests/999999");
        expect(res.status).toBe(401);
    });

    it("cancels a sent request", async () => {
        // admin sent a request to user (friendRequests[1])
        const requestId = s.friendRequests[1].id;
        const res = await api.delete(`/v1/users/me/friend-requests/${requestId}`, {
            token: s.users.admin.token,
        });
        expect(res.status).toBe(204);
    });

    it("returns 404 when trying to cancel a request you didn't send", async () => {
        // editor cannot cancel admin's request
        const res = await api.delete(`/v1/users/me/friend-requests/${s.friendRequests[1].id}`, {
            token: s.users.editor.token,
        });
        expect(res.status).toBe(404);
    });
});