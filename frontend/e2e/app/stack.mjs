/* =========================================================================
   A throwaway local stack for recording the in-app audit's API fixtures:
   a Postgres container, the API against it (IntegrationTesting environment —
   no demo data, local file storage (the seed uploads no files), email off, a random signing key), and the
   built frontend served with /api proxied to that API.

   Nothing here touches the developer's Aspire database or any cloud storage,
   and everything is torn down by stop(), however the caller ends.
   ========================================================================= */
import { spawn, spawnSync, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const here = import.meta.dirname;
const frontend = path.resolve(here, "../..");
const apiProject = path.resolve(frontend, "../backend/src/Platform.Api");

export const ADMIN = { email: "admin@audit.local", password: `Audit-${crypto.randomBytes(9).toString("base64url")}` };

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  s.on("error", reject);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(check, what, timeoutMs = 180_000) {
  const start = Date.now();
  for (;;) {
    try { if (await check()) return; } catch { /* not yet */ }
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await sleep(500);
  }
}
function cleanEnv(extra) {
  const env = { ...process.env, ...extra };
  for (const key of Object.keys(env)) if (key.startsWith("VSCODE_")) delete env[key];
  return env;
}

export async function startStack({ log = console.log } = {}) {
  const runId = `audit-${Date.now().toString(36)}`;
  const logDir = path.join(frontend, "e2e/.output", runId);
  fs.mkdirSync(logDir, { recursive: true });
  const cleanups = [];
  const startProcess = (name, command, args, options) => {
    const out = fs.openSync(path.join(logDir, `${name}.log`), "a");
    const child = spawn(command, args, { ...options, stdio: ["ignore", out, out] });
    cleanups.push(async () => {
      if (child.exitCode === null) { child.kill("SIGTERM"); await sleep(1500); if (child.exitCode === null) child.kill("SIGKILL"); }
    });
    return child;
  };
  const stop = async () => {
    for (const undo of cleanups.reverse()) { try { await undo(); } catch { /* keep going */ } }
  };

  try {
    const container = `platform-${runId}`;
    const [pgPort, apiPort, webPort] = [await freePort(), await freePort(), await freePort()];

    log(`starting a throwaway Postgres (${container})`);
    execFileSync("docker", ["run", "-d", "--rm", "--name", container, "-p", `${pgPort}:5432`,
      "-e", "POSTGRES_PASSWORD=audit", "-e", "POSTGRES_DB=platformdb", "postgres:17.6"], { stdio: "ignore" });
    cleanups.push(async () => { spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" }); });
    const psql = (sql) => execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-d", "platformdb", "-tA", "-c", sql], { encoding: "utf8" }).trim();
    await waitFor(() => psql("select 1") === "1", "Postgres");
    await sleep(2000); // the image restarts once after its init scripts

    log("starting the API");
    startProcess("api", "dotnet", ["run", "--project", apiProject, "--no-launch-profile"], {
      cwd: apiProject,
      env: cleanEnv({
        ASPNETCORE_ENVIRONMENT: "IntegrationTesting",
        ASPNETCORE_URLS: `http://localhost:${apiPort}`,
        ConnectionStrings__PlatformDB: `Host=localhost;Port=${pgPort};Database=platformdb;Username=postgres;Password=audit`,
        Jwt__Key: crypto.randomBytes(48).toString("base64"),
        Jwt__Issuer: "platform-api",
        Jwt__Audience: "platform-client",
        Cors__AllowedOrigins__0: `http://localhost:${webPort}`,
        Email__Enabled: "false",
        Storage__Provider: "Local",
        Storage__AssetTokenKey: crypto.randomBytes(48).toString("base64"),
        InitialPlatformOperator__Email: ADMIN.email,
        InitialPlatformOperator__Password: ADMIN.password,
      }),
    });
    await waitFor(async () => (await fetch(`http://localhost:${apiPort}/health`)).ok, "the API");

    log("building and serving the frontend");
    if (spawnSync("npm", ["run", "build"], { cwd: frontend, stdio: "ignore" }).status !== 0) throw new Error("The frontend build failed.");
    startProcess("web", "npx", ["vite", "preview", "--port", String(webPort), "--strictPort", "--host", "localhost"], {
      cwd: frontend, env: cleanEnv({ services__api__http__0: `http://localhost:${apiPort}` }),
    });
    await waitFor(async () => (await fetch(`http://localhost:${webPort}/`)).ok, "the frontend");

    return { apiBase: `http://localhost:${apiPort}`, webBase: `http://localhost:${webPort}`, stop, logDir };
  } catch (error) {
    await stop();
    throw error;
  }
}
