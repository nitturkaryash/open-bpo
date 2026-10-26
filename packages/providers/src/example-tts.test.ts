import assert from "node:assert/strict";
import test from "node:test";
import { runVoiceSessionLoop, MockSpeechToTextEngine, MockLanguageModelEngine } from "@open-bpo/core";
import { ExampleTextToSpeechEngine, exampleTtsFromEnv } from "./examples/example-tts";
import type { Fetch } from "./http";

const fakeFetch: Fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  const { text } = JSON.parse(String(init?.body)) as { text: string };
  return new Response(JSON.stringify({ audio: Buffer.from(text).toString("base64") }), { status: 200 });
}) as Fetch;

test("example TTS template returns base64 audio", async () => {
  const tts = new ExampleTextToSpeechEngine({ baseUrl: "http://tts.local/" }, fakeFetch);
  assert.equal(Buffer.from(await tts.synthesize("hello"), "base64").toString(), "hello");
});

test("example TTS surfaces HTTP errors", async () => {
  const failing = (async () => new Response("nope", { status: 503 })) as unknown as Fetch;
  await assert.rejects(new ExampleTextToSpeechEngine({ baseUrl: "http://tts.local" }, failing).synthesize("x"), /503/);
});

test("example TTS is off unless configured", () => {
  assert.equal(exampleTtsFromEnv({}), undefined);
  assert.ok(exampleTtsFromEnv({ EXAMPLE_TTS_URL: "http://tts.local" }, fakeFetch));
});

test("example TTS plugs into the voice session loop", async () => {
  const result = await runVoiceSessionLoop({
    userUtterances: ["hi"], stt: new MockSpeechToTextEngine(), llm: new MockLanguageModelEngine(),
    tts: new ExampleTextToSpeechEngine({ baseUrl: "http://tts.local" }, fakeFetch), tools: []
  });
  assert.equal(result.finalState, "completed");
  assert.equal(result.turns.length, 2);
});
