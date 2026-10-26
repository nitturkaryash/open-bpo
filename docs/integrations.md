# Integrations: Pipecat and LiveKit Agents

Status key: **works today** means it is in the repo and tested. **Planned** means it is not built yet.

## What works today
- **Works today:** the provider interfaces (`SpeechToTextEngine`, `LanguageModelEngine`, `TextToSpeechEngine`, `Provider`) and the session lifecycle (pending, active, completed or failed) that the API, worker and console track.
- **Works today:** Twilio and Exotel telephony adapters, which create calls pointed at your `MEDIA_STREAM_URL`, plus Sarvam, Deepgram, ElevenLabs and OpenAI-compatible/Azure adapters (see [providers.md](providers.md)).
- **Works today:** `TELEPHONY_PROVIDER=livekit` selects a placeholder `LiveKitProvider`. It returns a room-style session ID and media endpoint but **does not create a LiveKit room yet**.
- **Planned:** a bundled Pipecat or LiveKit Agents runtime, streaming audio frames, and barge-in. None of these ship yet.

## Plugging in Pipecat (pattern, runs as your own service)
Pipecat is a Python pipeline framework, so run it next to open-bpo rather than inside it:
1. Telephony: let the Twilio or Exotel adapter start the call with `MEDIA_STREAM_URL` pointing at your Pipecat service's WebSocket. Pipecat's Twilio/Exotel serializers handle the media stream.
2. Inside Pipecat, build `transport -> STT -> LLM -> TTS -> transport` with whichever Pipecat services you like.
3. When the call ends, POST the transcript to open-bpo (`POST /v1/webhooks/call-ended`, see [API_REFERENCE.md](API_REFERENCE.md)). The worker then scores it against the recipe's QA checklist and it shows up in the console.

That gives you open-bpo's recipes, QA and console on top of Pipecat's real-time audio. Session state updates from Pipecat back to open-bpo are **planned**.

## Plugging in LiveKit Agents (pattern)
1. Run a LiveKit Agents worker (Python or Node) connected to your LiveKit server. Use LiveKit SIP for phone numbers.
2. Name the room after open-bpo's `sessionId` so the two can be joined later.
3. On room end, post the transcript to `POST /v1/webhooks/call-ended` for QA scoring, the same as with Pipecat.
4. **Planned:** a real `LiveKitProvider.startSession` that creates the room and dispatches the agent. Design notes are in [providers.md](providers.md#livekit-recipe).
