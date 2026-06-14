import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.SMOKE_PORT || 4010);
const externalBaseUrl = process.env.SMOKE_BASE_URL?.trim();
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;

const checks = [
  { path: "/", status: 200 },
  { path: "/login", status: 200 },
  { path: "/dashboard", status: 307, locationSuffix: "/login?next=%2Fdashboard" },
  { path: "/transactions", status: 307, locationSuffix: "/login?next=%2Ftransactions" },
  { path: "/api/export/json", status: 401 },
  { path: "/api/auth/health", status: 403 },
];

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
  };
}

async function waitUntilReachable(timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await request("/login");
      if (result.status === 200) return;
    } catch {
      // retry
    }
    await delay(400);
  }
  throw new Error(`Smoke target did not become reachable within ${timeoutMs}ms: ${baseUrl}`);
}

async function runChecks() {
  for (const check of checks) {
    const result = await request(check.path);
    if (result.status !== check.status) {
      throw new Error(
        `Smoke check failed for ${check.path}: expected status ${check.status}, got ${result.status}.`
      );
    }
    if (
      check.locationSuffix &&
      !(result.location === check.locationSuffix || result.location.endsWith(check.locationSuffix))
    ) {
      throw new Error(
        `Smoke check failed for ${check.path}: expected redirect ending with "${check.locationSuffix}", got "${result.location}".`
      );
    }
    console.log(`ok ${check.path} -> ${result.status}${result.location ? ` ${result.location}` : ""}`);
  }
}

async function main() {
  if (externalBaseUrl) {
    await waitUntilReachable();
    await runChecks();
    return;
  }

  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  try {
    await waitUntilReachable();
    await runChecks();
  } finally {
    child.kill("SIGINT");
    await new Promise((resolve) => {
      child.once("exit", resolve);
      setTimeout(() => resolve(null), 2_000);
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
