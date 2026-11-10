import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import { loadChecklist, scoreTranscriptAgainstChecklist, type ScoreResult } from "@open-bpo/qa";
import { z } from "zod";
import { buildDemoTranscript } from "./demo-data";
import { listRecipeSummaries } from "./recipes";
import { registerConsoleRoutes } from "./console-routes";
import { registerApiFoundation, registerMcpRoutes } from "./server";

type Direction = "inbound" | "outbound";
type Transcript = ReturnType<typeof buildDemoTranscript>;

interface DemoCall {
  callId: string;
  direction: Direction;
  durationSeconds: number;
  transcript: Transcript;
  recipeId: string;
  createdAt: string;
  qa: ScoreResult;
  sessionId: string;
}

interface DemoSession {
  sessionId: string;
  callId: string;
  provider: "mock" | "twilio" | "livekit";
  direction: Direction;
  recipeId: string;
  state: "pending" | "assigned" | "active" | "completed";
  externalSessionId: string | null;
  turns: Array<{ speaker: string; text: string }> | null;
  trace: string[];
  error: null;
  createdAt: string;
  updatedAt: string;
}

const checklistCache = new Map<string, Awaited<ReturnType<typeof loadChecklist>>>();

async function resolveChecklistPath(recipeId: string): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "recipes", recipeId, "checklist.json"),
    path.resolve(process.cwd(), "..", "..", "recipes", recipeId, "checklist.json")
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported workspace location.
    }
  }
  throw new Error(`Checklist not found for recipe: ${recipeId}`);
}

async function getChecklist(recipeId: string) {
  const cached = checklistCache.get(recipeId);
  if (cached) return cached;
  const checklist = await loadChecklist(await resolveChecklistPath(recipeId));
  checklistCache.set(recipeId, checklist);
  return checklist;
}

function advanceSession(session: DemoSession, calls: DemoCall[]): void {
  const update = (state: DemoSession["state"], trace: string) => {
    session.state = state;
    session.trace.push(trace);
    session.updatedAt = new Date().toISOString();
  };
  setTimeout(() => update("assigned", "worker: session assigned to mock provider"), 150);
  setTimeout(() => update("active", "provider: mock audio stream connected"), 450);
  setTimeout(() => {
    update("completed", "worker: transcript scored and session completed");
    session.externalSessionId = `mock-${session.sessionId.slice(0, 8)}`;
    session.turns = calls.find((call) => call.callId === session.callId)?.transcript ?? null;
  }, 900);
}

export async function buildDemoApp(options: { env?: NodeJS.ProcessEnv; apiUrl?: string } = {}) {
  const env = options.env ?? process.env;
  const app = Fastify({ logger: true });
  const calls: DemoCall[] = [];
  const sessions: DemoSession[] = [];
  await registerApiFoundation(app, { env, title: "open-bpo demo API" });

  app.get("/health", async () => ({ status: "ok", service: "open-bpo-demo-api" }));
  app.get("/v1/recipes", async () => ({ recipes: await listRecipeSummaries(process.cwd()) }));
  registerConsoleRoutes(app, { cwd: process.cwd(), env: process.env });
  app.get("/v1/calls", async () => ({
    calls: calls.map((call) => ({
      callId: call.callId,
      direction: call.direction,
      durationSeconds: call.durationSeconds,
      recipeId: call.recipeId,
      createdAt: call.createdAt,
      qaPercent: call.qa.qaPercent,
      verdict: call.qa.verdict,
      hasFatalErrors: call.qa.hasFatalErrors,
      latestSessionState: sessions.find((session) => session.sessionId === call.sessionId)?.state ?? null
    }))
  }));
  app.get("/v1/calls/:callId/qa", async (request, reply) => {
    const { callId } = z.object({ callId: z.string() }).parse(request.params);
    const call = calls.find((candidate) => candidate.callId === callId);
    if (!call) return reply.code(404).send({ error: "Call not found" });
    return {
      status: "ready",
      call: {
        callId: call.callId,
        direction: call.direction,
        durationSeconds: call.durationSeconds,
        recipeId: call.recipeId,
        transcript: call.transcript,
        createdAt: call.createdAt,
        qa: {
          finalScore: call.qa.finalScore,
          maxPossible: call.qa.maxPossible,
          qaPercent: call.qa.qaPercent,
          verdict: call.qa.verdict,
          hasFatalErrors: call.qa.hasFatalErrors,
          updatedAt: call.createdAt,
          result: call.qa
        }
      }
    };
  });
  app.get("/v1/sessions", async () => ({ sessions }));
  app.get("/v1/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = z.object({ sessionId: z.string() }).parse(request.params);
    const session = sessions.find((candidate) => candidate.sessionId === sessionId);
    return session ? { session } : reply.code(404).send({ error: "Session not found" });
  });
  app.post("/v1/demo/calls/:direction", async (request, reply) => {
    const { direction } = z.object({ direction: z.enum(["inbound", "outbound"]) }).parse(request.params);
    const payload = z.object({ recipeId: z.string().default("lead-qualification"), provider: z.enum(["mock", "twilio"]).default("mock") }).parse(request.body ?? {});
    const availableRecipes = await listRecipeSummaries(process.cwd());
    if (!availableRecipes.some((recipe) => recipe.id === payload.recipeId)) {
      return reply.code(400).send({ error: `Unknown recipeId: ${payload.recipeId}` });
    }

    const createdAt = new Date().toISOString();
    const transcript = buildDemoTranscript(direction, payload.recipeId);
    const checklist = await getChecklist(payload.recipeId);
    const qa = scoreTranscriptAgainstChecklist({ checklist, transcript });
    const sessionId = randomUUID();
    const callId = `${direction}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const session: DemoSession = {
      sessionId,
      callId,
      provider: payload.provider,
      direction,
      recipeId: payload.recipeId,
      state: "pending",
      externalSessionId: null,
      turns: null,
      trace: ["api: call received and queued"],
      error: null,
      createdAt,
      updatedAt: createdAt
    };
    calls.unshift({ callId, direction, durationSeconds: direction === "inbound" ? 210 : 180, transcript, recipeId: payload.recipeId, createdAt, qa, sessionId });
    sessions.unshift(session);
    calls.splice(200);
    sessions.splice(200);
    advanceSession(session, calls);
    return reply.code(202).send({ status: "queued", callId, direction, qaJobId: `demo-${callId}`, session: { sessionId, jobId: `demo-${sessionId}` } });
  });

  registerMcpRoutes(app, { env, apiUrl: options.apiUrl ?? "http://127.0.0.1:4017" });
  return app;
}

async function main(): Promise<void> {
  const port = Number(process.env.DEMO_API_PORT ?? 4017);
  const app = await buildDemoApp({ apiUrl: `http://127.0.0.1:${port}` });
  await app.listen({ host: "0.0.0.0", port });
  console.log(`demo API ready at http://127.0.0.1:${port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
