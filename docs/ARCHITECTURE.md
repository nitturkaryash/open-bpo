# open-bpo Architecture

## Vision

open-bpo is an OSS baseline for building deployable AI-enabled BPO operations:
- call/session orchestration contracts
- provider abstraction points
- checklist-driven QA scoring
- operations console and API surface

## Runtime diagram

```text
                       +-------------------+
                       |  apps/web console |
                       +---------+---------+
                                 |
                                 | HTTP (calls/sessions/qa)
                                 v
+--------------+        +--------+--------+          +----------------+
| demo/webhook | -----> |    apps/api     | -------> |    Redis       |
| callers      |        | Fastify + queue |          | BullMQ queues  |
+--------------+        +--------+--------+          +--------+-------+
                                 |                            |
                                 | SQL                        | consume
                                 v                            v
                          +------+-------+            +-------+-------+
                          |  Postgres    |            | apps/worker   |
                          | calls/qa/... | <--------- | QA + sessions |
                          +--------------+            +-------+-------+
                                                             |
                                                     +-------+-------+
                                                     | packages/core |
                                                     | packages/qa   |
                                                     | providers     |
                                                     +---------------+
```

## Core data flow

### A) Call-ended QA path

1. `POST /v1/webhooks/call-ended` or `/v1/demo/calls/:direction`
2. API upserts `calls` row
3. API enqueues `qa-scoring` job
4. Worker loads recipe checklist and scores transcript
5. Worker upserts `qa_results`
6. UI/API fetches `GET /v1/calls/:id/qa`

### B) Session path

1. `POST /v1/sessions` or demo call endpoint with `startSession=true`
2. API creates session row (`pending`) and enqueues `session-loop`
3. Worker transitions state (`assigned` -> `active` -> `completed|failed`)
4. Worker writes `trace` and `turns`
5. UI renders session lifecycle

## Package boundaries

- `packages/core`: type contracts + mock voice loop + state model
- `packages/providers`: provider abstraction, mock adapters and optional real adapters (see [providers.md](providers.md))
- `packages/qa`: recipe schema + deterministic scoring engine

## Open vs closed boundary

### In open-bpo (this repo)
- public-safe contracts
- mock provider path
- deterministic recipe scoring
- local deployment story

### In QualiaBits / CallPulse (commercial)
- multi-tenant auth and billing
- managed infra and dialer IP
- production provider credentials and orchestration
- enterprise observability/governance
- customer-specific prompt ops and proprietary optimization

## Migration notes for maintainers

1. Implement real media/provider adapters behind `Provider` interface.
2. Swap mock STT/LLM/TTS engines with production adapters in `packages/core`.
3. Preserve queue contract compatibility (`QaScoringJob`, `SessionLoopJob`).
4. Add tenant/auth boundary in API before public internet exposure.
5. Add durable recipe/version management beyond filesystem.
