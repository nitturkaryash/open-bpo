/**
 * Template: a custom TTS provider in ~50 lines.
 * Copy this file, rename the class, and replace the fetch call with your vendor's API.
 * The same shape works for STT (`transcribe`) and LLM (`respond`): see packages/core/src/session-loop.ts.
 */
import type { TextToSpeechEngine } from "@open-bpo/core";
import type { Fetch } from "../http";

export interface ExampleTtsConfig {
  /** Base URL of your TTS service, e.g. http://localhost:8080 */
  baseUrl: string;
  /** Optional API key. Read it from env, never hardcode it. */
  apiKey?: string;
  voice?: string;
}

export class ExampleTextToSpeechEngine implements TextToSpeechEngine {
  constructor(private readonly config: ExampleTtsConfig, private readonly fetch: Fetch = globalThis.fetch) {}

  /** Returns base64 audio, matching the built-in adapters. */
  async synthesize(text: string): Promise<string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    const response = await this.fetch(`${this.config.baseUrl.replace(/\/$/, "")}/synthesize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, voice: this.config.voice ?? "default" })
    });
    if (!response.ok) throw new Error(`example TTS failed with HTTP ${response.status}`);
    const body = (await response.json()) as { audio?: unknown };
    if (typeof body.audio !== "string") throw new Error("example TTS response is missing audio");
    return body.audio;
  }
}

/** Build from env so mock mode stays the default when nothing is set. */
export function exampleTtsFromEnv(env: Record<string, string | undefined> = process.env, fetch: Fetch = globalThis.fetch): ExampleTextToSpeechEngine | undefined {
  if (!env.EXAMPLE_TTS_URL) return undefined;
  return new ExampleTextToSpeechEngine({ baseUrl: env.EXAMPLE_TTS_URL, ...(env.EXAMPLE_TTS_KEY ? { apiKey: env.EXAMPLE_TTS_KEY } : {}) }, fetch);
}
