import { spawn } from "node:child_process";

const apiPort = process.env.DEMO_API_PORT ?? "4017";
const webPort = process.env.DEMO_WEB_PORT ?? "43123";
const env = { ...process.env, DEMO_API_PORT: apiPort, VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? `http://127.0.0.1:${apiPort}` };

const processes = [
  ["api", ["--filter", "@open-bpo/api", "demo"]],
  ["worker", ["--filter", "@open-bpo/worker", "demo"]],
  ["web", ["--filter", "@open-bpo/web", "exec", "vite", "--host", "0.0.0.0", "--port", webPort, "--strictPort"]]
].map(([name, args]) => {
  const child = spawn("pnpm", args, { stdio: "inherit", env });
  child.on("exit", (code, signal) => {
    if (!stopping && (code !== 0 || signal)) {
      console.error(`${name} stopped unexpectedly`);
      stop(code ?? 1);
    }
  });
  return child;
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 200).unref();
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
console.log(`open-bpo demo starting: console http://127.0.0.1:${webPort} (API on ${apiPort})`);
