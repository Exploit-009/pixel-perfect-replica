// Server-only adapter for the separately provisioned isolated runner.
// Nothing here ever executes a command locally; without a configured runner every call is refused.

export interface RunnerConfig { url: string; token: string }

export function runnerConfig(): RunnerConfig | null {
  const url = process.env["XPLO_RUNNER_URL"];
  const token = process.env["XPLO_RUNNER_TOKEN"];
  if (!url || !token || !url.startsWith("https://")) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export class RunnerError extends Error {}

export async function runnerCall<T>(path: string, method: "POST" | "DELETE", body: unknown, timeoutMs = 130_000): Promise<T> {
  const cfg = runnerConfig();
  if (!cfg) throw new RunnerError("The isolated runner is not connected.");
  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new RunnerError("The isolated runner could not be reached.");
  }
  if (!res.ok) throw new RunnerError(`The runner refused the request (HTTP ${res.status}).`);
  return (await res.json().catch(() => ({}))) as T;
}
