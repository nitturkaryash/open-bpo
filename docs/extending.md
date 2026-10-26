# Extending open-bpo: add your own provider in ~50 lines

Every provider category is a small TypeScript interface. You can add a vendor by implementing that one interface.

| Category | Interface | Method | Defined in |
|---|---|---|---|
| STT | `SpeechToTextEngine` | `transcribe(chunk) => Promise<string>` | `packages/core/src/session-loop.ts` |
| LLM | `LanguageModelEngine` | `respond(input) => Promise<string>` | `packages/core/src/session-loop.ts` |
| TTS | `TextToSpeechEngine` | `synthesize(text) => Promise<string>` (base64 audio) | `packages/core/src/session-loop.ts` |
| Telephony | `Provider` | `startSession`, `stopSession`, `parseInboundWebhook`, `inboundResponse` | `packages/providers/src/telephony.ts` |

## Worked example (TTS)

[`packages/providers/src/examples/example-tts.ts`](../packages/providers/src/examples/example-tts.ts) is a complete TTS adapter in about 40 lines. It calls an HTTP endpoint, returns base64 audio, surfaces HTTP errors, and reads its config from env (`EXAMPLE_TTS_URL`, `EXAMPLE_TTS_KEY`). Its test is [`example-tts.test.ts`](../packages/providers/src/example-tts.test.ts). The test uses a fake `fetch` and runs the adapter through `runVoiceSessionLoop`, so it needs no keys or network.

1. Copy `examples/example-tts.ts` to `src/<vendor>-tts.ts` and rename the class.
2. Replace the request and response mapping with your vendor's API. Take `fetch` as a constructor argument so tests can inject a fake.
3. Register it in `createProviderBundle` (`packages/providers/src/index.ts`) behind a selector, for example `TTS_PROVIDER=<vendor>`. Use the existing `values()` helper so that missing env vars log a warning and fall back to mock.
4. Add the variable **names** (never values) to `.env.example` and `docs/providers.md`.
5. Copy the test. Run `pnpm test` and `pnpm typecheck`.

STT and LLM adapters have the same shape: one async method, string in and string out. Telephony adapters implement four methods. Use `TwilioProvider` in `telephony.ts` as the reference.

## Rules
- Mock stays the default. `pnpm demo` and CI must keep working with no keys.
- Never hardcode credentials or put them in fallbacks. Read them from env only.
- Today's interfaces are request/response (no streaming). Streaming audio interfaces are **planned**; see [ROADMAP.md](../ROADMAP.md).
