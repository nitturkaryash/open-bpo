# Providers

With no keys, every category uses a mock adapter, so `pnpm demo` runs the full session lifecycle locally without placing calls. With your own keys you can switch on real adapters that ship in `packages/providers`: Twilio and Exotel telephony, Sarvam and Deepgram STT, Sarvam and ElevenLabs TTS, and any OpenAI-compatible or Azure OpenAI LLM (see [Configuring the built-in providers](#configuring-the-built-in-providers)). A production adapter should keep vendor SDKs behind the small interfaces in `packages/core` and `packages/providers`.

## Extension points

Telephony and room lifecycle implement `Provider` in `packages/providers/src/index.ts`:

```ts
interface Provider {
  readonly provider: SessionProvider;
  startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle>;
  stopSession(externalSessionId: string): Promise<void>;
}
```

The voice loop accepts three independent engines from `packages/core/src/session-loop.ts`:

```ts
interface SpeechToTextEngine {
  transcribe(chunk: string): Promise<string>;
}

interface LanguageModelEngine {
  respond(input: string): Promise<string>;
}

interface TextToSpeechEngine {
  synthesize(text: string): Promise<string>;
}
```

The current string input/output is deliberately simple. For streaming audio, introduce an additive streaming interface and keep these interfaces as the mock/test compatibility layer.

## Adapter workflow

1. Add the vendor SDK to `packages/providers` or a new workspace package. Do not add it to `core`.
2. Implement the narrow interface and translate vendor IDs, events, and errors into open-bpo types.
3. Add the provider name to `SessionProvider` only when it can be selected end to end.
4. Register the adapter in `providerFactory` and construct the STT/LLM/TTS engines in the worker from validated configuration.
5. Convert provider webhooks into the existing API call/session events. Make webhook handling idempotent by vendor event ID.
6. Test against a fake HTTP/WebSocket server. Keep `mock` as the default and keep CI credential-free.

Do not return credentials in `mediaEndpoint`, traces, API responses, or errors. Load secrets from the deployment environment or a secret manager, never recipe files.

## LiveKit recipe

LiveKit is a useful transport when the agent and caller join the same real-time room.

- Implement `LiveKitProvider.startSession` by creating or selecting a room named from the internal session ID.
- Issue short-lived participant tokens with only the grants needed to join and publish/subscribe.
- Put the room name in `externalSessionId`; expose a server-side WebSocket URL as `mediaEndpoint`, not a privileged token.
- Run an agent participant that subscribes to caller audio and publishes synthesized audio.
- Translate participant disconnect and room-ended events to session completion, then make `stopSession` delete or close the room idempotently.

Typical configuration names are `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`. Add names—not values—to `.env.example` only when the adapter lands.

## Pipecat recipe

Pipecat is an orchestration framework rather than a telephony carrier. Use it inside a worker-side agent service:

1. Receive a LiveKit, Twilio Media Streams, or WebSocket endpoint from the telephony `Provider`.
2. Build a Pipecat pipeline with the chosen transport, STT service, context/LLM processor, and TTS service.
3. Adapt pipeline start/stop to `startSession` and `stopSession`, or expose a small internal service that the BullMQ worker calls.
4. Persist only normalized transcript turns and lifecycle events through open-bpo. Keep raw audio retention off by default.

Pipecat service objects can wrap `SpeechToTextEngine`, `LanguageModelEngine`, and `TextToSpeechEngine` for non-streaming compatibility. For a streaming implementation, add explicit frame and cancellation types instead of encoding audio into strings.

## Twilio recipe

Use Twilio Programmable Voice for call control and Media Streams for bidirectional audio.

- `startSession` creates or accepts a call and returns the Call SID as `externalSessionId`.
- TwiML connects the call to a `wss://` Media Stream owned by the adapter.
- Validate `X-Twilio-Signature` on every public webhook before enqueueing work.
- Map `CallSid` and `StreamSid` to the internal call/session IDs in durable storage; do not depend on in-memory maps.
- `stopSession` updates an active call to completed and tolerates an already-ended call.
- Normalize delivered, failed, busy, and no-answer statuses before updating session state.

Use separate credentials and webhook URLs per environment. Never log auth tokens or signed request bodies.

## Exotel recipe

Exotel can supply call control and status callbacks; media capabilities depend on the selected Exotel product and region.

- Implement a new `ExotelProvider` and extend `SessionProvider` plus `providerFactory`.
- Store the Exotel Call SID as `externalSessionId` and map Exotel terminal statuses to completed or failed.
- Verify callbacks according to the current Exotel webhook guidance and allow-list only the expected event fields.
- If using Exotel Voice Streaming, bridge its WebSocket frames to the selected STT/TTS pipeline. Keep call control separate from media processing.
- Make hang-up idempotent and handle callbacks that arrive out of order.

Keep account SID, API key, API token, and application IDs in deployment secrets. Consult the current regional Exotel API documentation before choosing endpoints; do not hard-code a regional host in shared code.

## STT, LLM, and TTS adapters

An adapter should own vendor-specific request formatting, timeouts, retries, rate-limit errors, and cancellation. The session loop should receive normalized text.

- STT: normalize partial/final results, language tags, silence, and confidence. Do not put raw audio in traces.
- LLM: build context from the recipe prompt and permitted tools, bound response length, and treat tool arguments as untrusted input.
- TTS: return or stream audio in the transport's required codec, and support interruption before adding barge-in.

Add contract tests that run the same fixture through mock and real-adapter fakes. A real-provider smoke test belongs in an opt-in workflow with protected secrets, never the default pull-request workflow.

## Production boundary

Before exposing an adapter publicly, add authentication and tenant isolation, webhook replay protection, rate limits, timeouts, structured redaction, retention controls, observability, and a dead-letter/replay policy. The repository is a scaffold and does not claim those controls by default.

## Configuring the built-in providers

All adapters are opt-in. With the selector variables unset (or set to `mock`), `pnpm demo` remains local and keyless. Copy `.env.example` to `.env`, choose providers, and fill only the variables for those providers. Never commit `.env`.

### Telephony

Set `TELEPHONY_PROVIDER=twilio` with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_TO_NUMBER`, and a public `MEDIA_STREAM_URL`. Twilio inbound webhooks can be parsed with `TwilioProvider.parseInboundWebhook()`; return `inboundResponse()` as `text/xml` to connect the call to the media WebSocket.

Set `TELEPHONY_PROVIDER=exotel` with `EXOTEL_ACCOUNT_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_FROM_NUMBER`, `EXOTEL_TO_NUMBER`, `EXOTEL_CALLER_ID`, and `MEDIA_STREAM_URL`. `EXOTEL_BASE_URL` is optional for regional API hosts. Use the matching parse/response methods for inbound Exotel webhooks.

Outbound sessions use the configured numbers by default. Code may override `from`, `to`, or `mediaStreamUrl` in `ProviderStartRequest`.

### Speech

For Sarvam STT, set `STT_PROVIDER=sarvam` and `SARVAM_API_KEY`. For Deepgram, set `STT_PROVIDER=deepgram` and `DEEPGRAM_API_KEY`.

For Sarvam TTS, set `TTS_PROVIDER=sarvam` and `SARVAM_API_KEY`. For ElevenLabs, set `TTS_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_VOICE_ID`.

The simple core interfaces carry audio as strings: STT sends the string as WAV content, while TTS returns vendor-provided base64 (and base64-encodes ElevenLabs audio).

### LLM

Set `LLM_PROVIDER=openai`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `MODEL`. The base URL may be any OpenAI-compatible endpoint and may include `/chat/completions` already.

For Azure OpenAI, use the deployment base URL and set `AZURE_OPENAI_API_VERSION`. Azure URLs use the `api-key` header and an `api-version` query parameter; other endpoints use bearer authentication.

If any required variable is absent, that category logs one warning naming only the missing variables and uses its mock adapter.
