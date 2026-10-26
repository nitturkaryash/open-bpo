# Roadmap

open-bpo is a small, runnable reference stack. Every item keeps the no-key mock path working and keeps customer data, credentials and private prompts out of the repo. Want to help? Pick a `good first issue` and comment to claim it.

## Now (shipped, or being worked on)
- ✅ Keyless `pnpm demo`: simulated inbound and outbound calls, ops console, session traces, deterministic QA with fatal checks
- ✅ Recipes: lead qualification, support, payment reminders
- ✅ Optional real providers with your own keys: Twilio, Exotel, Sarvam, Deepgram, ElevenLabs, OpenAI-compatible or Azure ([providers.md](docs/providers.md))
- ✅ Provider template with a test ([extending.md](docs/extending.md)), Docker Compose and Codespaces setup, gitleaks in CI
- 🚧 MCP server and agent compatibility (PR #12)
- 🚧 Session duration in the console ([#9](https://github.com/nitturkaryash/open-bpo/issues/9), claimed)

## Next (good first issues, open for contributors)
- [#2](https://github.com/nitturkaryash/open-bpo/issues/2) API health endpoint test
- [#3](https://github.com/nitturkaryash/open-bpo/issues/3) Empty-state screenshot test
- [#4](https://github.com/nitturkaryash/open-bpo/issues/4) Document alternate demo ports
- [#5](https://github.com/nitturkaryash/open-bpo/issues/5) Recipe ID validation
- [#6](https://github.com/nitturkaryash/open-bpo/issues/6) Cleaner demo shutdown logging
- [#7](https://github.com/nitturkaryash/open-bpo/issues/7) QA verdict filter
- [#8](https://github.com/nitturkaryash/open-bpo/issues/8) Test demo call retention
- Recipe validation in CI, plus contract tests for API routes and queue payloads
- Docker Compose health check for the web service

## Later (planned, not built)
- Real `LiveKitProvider` (create rooms, dispatch agents) and a Pipecat bridge ([integrations.md](docs/integrations.md))
- Streaming audio interfaces (frames, cancellation, barge-in)
- OpenTelemetry traces across API, queue, worker and database
- Authentication and a tenant-boundary reference implementation
- Postgres migrations with a documented upgrade and rollback flow
- Retry, dead-letter and replay tools for failed jobs
- Browser tests for the golden path
- Human handoff and supervisor intervention contracts
- Versioned recipe registry and evaluation datasets
- Kubernetes deployment example with production security notes
- Retention controls for transcripts and call metadata

These are directions, not release commitments. Open a feature request before starting a cross-package change.

## More starter ideas
Unit tests for the `keyword_any`, `keyword_all`, `keyword_none` and regex checklist rules · checking that `warningThreshold` doesn't exceed `passThreshold` · a recipe-validation CLI · sorted `/v1/recipes` · copy buttons for IDs · a recipe filter · checklist version in the QA panel · loading skeletons · accessible labels and focus states · fixtures for the support and payment-reminder recipes · graceful shutdown for the API and workers.
