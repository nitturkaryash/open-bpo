import { spawn } from "node:child_process";

let stopping = false;
let exitCode = 0;
const children = new Set();

function finish() {
  if (!stopping || children.size > 0) return;
  console.log("open-bpo demo stopped: API, worker, and web processes have exited");
  process.exit(exitCode);
}

function stop(code = 0) {
  if (stopping) {
    if (code !== 0) exitCode = code;
    return;
  }

  stopping = true;
  exitCode = code;

  for (const child of children) {
    child.kill("SIGTERM");
  }

  finish();
}

const processes = [
  ["api", ["--filter", "@open-bpo/api", "demo"]],
  ["worker", ["--filter", "@open-bpo/worker", "demo"]],
  ["web", ["--filter", "@open-bpo/web", "dev"]]
];

for (const [name, args] of processes) {
  const child = spawn("pnpm", args, {
    stdio: "inherit",
    // The demo is mock-only and local; the API otherwise refuses to serve without a token.
    env: { OPEN_BPO_ALLOW_NO_AUTH: "true", ...process.env }
  });

  children.add(child);

  child.on("error", (error) => {
    console.error(`${name} failed: ${error.message}`);
    stop(1);
  });

  child.on("close", (code) => {
    children.delete(child);

    if (!stopping) {
      console.error(`${name} stopped unexpectedly`);
      stop(code === 0 ? 1 : code ?? 1);
    }

    finish();
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

console.log("open-bpo demo starting: console http://127.0.0.1:43123");
