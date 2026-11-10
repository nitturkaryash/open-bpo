import { afterEach, describe, expect, it } from "vitest";
import { buildDemoApp } from "./demo";

const apps: Awaited<ReturnType<typeof buildDemoApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API authentication", () => {
  it("keeps health open and protects v1 routes when configured", async () => {
    const token = "test-auth-marker";
    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_API_TOKEN: token } });
    apps.push(app);

    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/recipes" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/recipes", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/mcp" })).statusCode).toBe(401);
  });

  it("refuses production startup without a token", async () => {
    await expect(buildDemoApp({ env: { NODE_ENV: "production" } })).rejects.toThrow("OPEN_BPO_API_TOKEN is required");
  });

  it("fails closed with 503 on /v1 and /mcp when no token is configured", async () => {
    for (const env of [{ NODE_ENV: "test" }, {}, { NODE_ENV: "staging" }, { NODE_ENV: "prod", OPEN_BPO_API_TOKEN: "   " }]) {
      const app = await buildDemoApp({ env });
      apps.push(app);
      expect((await app.inject({ method: "GET", url: "/v1/recipes" })).statusCode).toBe(503);
      expect((await app.inject({ method: "GET", url: "/V1/recipes?x=1" })).statusCode).toBe(503);
      expect((await app.inject({ method: "POST", url: "/v1/sessions", payload: { provider: "twilio" } })).statusCode).toBe(503);
      expect((await app.inject({ method: "POST", url: "/v1/demo/calls/inbound", payload: { startSession: true } })).statusCode).toBe(503);
      expect((await app.inject({ method: "POST", url: "/mcp" })).statusCode).toBe(503);
      expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    }
  });

  it("allows tokenless access only with the explicit local-demo opt-in", async () => {
    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: "true" } });
    apps.push(app);
    expect((await app.inject({ method: "GET", url: "/v1/recipes" })).statusCode).toBe(200);
    for (const value of ["1", "yes", "TRUE", ""]) {
      const strict = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: value } });
      apps.push(strict);
      expect((await strict.inject({ method: "GET", url: "/v1/recipes" })).statusCode).toBe(503);
    }
  });

  it("still enforces the token when both a token and the opt-in are set", async () => {
    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_API_TOKEN: "t", OPEN_BPO_ALLOW_NO_AUTH: "true" } });
    apps.push(app);
    expect((await app.inject({ method: "GET", url: "/v1/recipes" })).statusCode).toBe(401);
  });

  it("rejects the unimplemented livekit provider in request bodies", async () => {
    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: "true" } });
    apps.push(app);
    const response = await app.inject({ method: "POST", url: "/v1/demo/calls/inbound", payload: { provider: "livekit" } });
    // Schema validation rejects it (the API has no custom error handler, so this surfaces as an error status).
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("returns 400 for an unknown recipe ID without creating a call or session", async () => {
    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: "true" } });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/demo/calls/inbound",
      payload: { recipeId: "recipe-that-does-not-exist" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Unknown recipeId: recipe-that-does-not-exist" });
    expect((await app.inject({ method: "GET", url: "/v1/calls" })).json().calls).toHaveLength(0);
    expect((await app.inject({ method: "GET", url: "/v1/sessions" })).json().sessions).toHaveLength(0);
  });

  it("queues a demo call when the recipe ID exists", async () => {
    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: "true" } });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/demo/calls/inbound",
      payload: { recipeId: "lead-qualification" }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe("queued");
    expect(response.json().callId).toBeTruthy();
    expect((await app.inject({ method: "GET", url: "/v1/calls" })).json().calls).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/v1/sessions" })).json().sessions).toHaveLength(1);
  });
});
