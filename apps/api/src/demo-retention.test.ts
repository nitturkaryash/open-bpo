import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDemoApp } from "./demo";

const apps: Awaited<ReturnType<typeof buildDemoApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
});

describe("demo call retention", () => {
  it("retains only the newest 200 calls and sessions", async () => {
    let timestamp = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => timestamp++);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: "true" } });
    apps.push(app);

    const created: Array<{ callId: string; sessionId: string }> = [];

    for (let index = 0; index < 201; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/demo/calls/inbound",
        payload: { recipeId: "lead-qualification" }
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      created.push({ callId: body.callId, sessionId: body.session.sessionId });
    }

    const calls = (await app.inject({ method: "GET", url: "/v1/calls" })).json().calls;
    const sessions = (await app.inject({ method: "GET", url: "/v1/sessions" })).json().sessions;
    const retained = created.slice(1).reverse();

    expect(calls).toHaveLength(200);
    expect(sessions).toHaveLength(200);
    expect(calls.map((call: { callId: string }) => call.callId)).toEqual(retained.map((item) => item.callId));
    expect(sessions.map((session: { sessionId: string }) => session.sessionId)).toEqual(retained.map((item) => item.sessionId));
  });
});
