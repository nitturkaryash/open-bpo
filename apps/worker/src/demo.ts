const apiBaseUrl = `http://127.0.0.1:${process.env.DEMO_API_PORT ?? 4017}`;
const recipes = ["lead-qualification", "support"] as const;
let sequence = 0;

async function waitForApi(): Promise<void> {
  while (true) {
    try {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The API process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function streamCall(): Promise<void> {
  const direction = sequence % 2 === 0 ? "inbound" : "outbound";
  const recipeId = recipes[sequence % recipes.length] ?? "lead-qualification";
  sequence += 1;
  const response = await fetch(`${apiBaseUrl}/v1/demo/calls/${direction}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipeId, provider: "mock", startSession: true })
  });
  if (!response.ok) throw new Error(`demo API returned ${response.status}`);
  const result = (await response.json()) as { callId: string };
  console.log("simulated call completed", { callId: result.callId, direction, recipeId });
}

async function main(): Promise<void> {
  await waitForApi();
  for (let index = 0; index < 4; index += 1) await streamCall();
  console.log("demo worker online; streaming a call every 8 seconds");
  setInterval(() => void streamCall().catch(console.error), 8000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
