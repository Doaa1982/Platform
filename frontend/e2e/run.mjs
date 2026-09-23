/* =========================================================================
   The browser test's isolated stack, and its cleanup.

   Starts, on free ports:  a throwaway Postgres container, the API against it
   (Development environment, dev R2 bucket via the developer's user-secrets,
   presigned-URL lifetime 30 s), and the BUILT frontend. Seeds a tutor with a
   lesson video through the API, runs Playwright, and — in a finally block that
   runs however the test ends — deletes every object it uploaded to the dev
   bucket, stops the servers and removes the database. Nothing here touches the
   developer's own Aspire database, and it never talks to the production bucket.

   Needs:  E2E_VIDEO_PATH   an H.264 .mp4 well over a minute long
           Docker, dotnet, and Google Chrome.
   ========================================================================= */
import { spawn, spawnSync, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { seedTutorWithVideo } from "./lib/seed.mjs";

const here = import.meta.dirname;
const frontend = path.resolve(here, "..");
const repo = path.resolve(frontend, "..");
const apiProject = path.join(repo, "backend/src/Platform.Api");
const testProject = path.join(repo, "backend/src/Platform.Api.IntegrationTests");
const DEV_BUCKET = "learning-workspace-dev";

const runId = `e2e-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const logDir = path.join(here, ".output", runId);
fs.mkdirSync(logDir, { recursive: true });

const cleanups = []; // run in reverse, always
const log = (m) => console.log(`[e2e ${runId}] ${m}`);

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  s.on("error", reject);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(check, what, timeoutMs = 120_000) {
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
function start(name, command, args, options) {
  const out = fs.openSync(path.join(logDir, `${name}.log`), "a");
  const child = spawn(command, args, { ...options, stdio: ["ignore", out, out], detached: false });
  cleanups.push(async () => {
    if (child.exitCode === null) { child.kill("SIGTERM"); await sleep(1500); if (child.exitCode === null) child.kill("SIGKILL"); }
  });
  return child;
}

/** The developer's dev-bucket credentials, read from user-secrets into memory only — never printed. */
function devR2Credentials() {
  const listing = execFileSync("dotnet", ["user-secrets", "list", "--project", apiProject], { encoding: "utf8" });
  const get = (k) => listing.split("\n").map((l) => l.split(" = ")).find(([key]) => key?.trim() === k)?.[1]?.trim();
  const creds = { accessKey: get("Storage:R2:AccessKeyId"), secret: get("Storage:R2:SecretAccessKey") };
  if (!creds.accessKey || !creds.secret) throw new Error("Storage:R2 credentials are not in this machine's user-secrets.");
  return creds;
}

async function main() {
  const videoPath = process.env.E2E_VIDEO_PATH;
  if (!videoPath || !fs.existsSync(videoPath)) throw new Error("Set E2E_VIDEO_PATH to an H.264 .mp4 that is well over a minute long.");

  const container = `platform-${runId}`;
  const [pgPort, apiPort, webPort] = [await freePort(), await freePort(), await freePort()];

  // ── 1. throwaway Postgres ────────────────────────────────────────────
  log(`starting a throwaway Postgres (${container}) on :${pgPort}`);
  execFileSync("docker", ["run", "-d", "--rm", "--name", container, "-p", `${pgPort}:5432`,
    "-e", "POSTGRES_PASSWORD=e2e", "-e", "POSTGRES_DB=platformdb", "postgres:17.6"], { stdio: "ignore" });
  cleanups.push(async () => { spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" }); });
  const psql = (sql) => execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-d", "platformdb", "-tA", "-c", sql], { encoding: "utf8" }).trim();
  await waitFor(() => psql("select 1") === "1", "Postgres");
  await sleep(2000); // the image restarts once after its init scripts

  // Whatever happens, remember which object-key prefixes this run created, before the database goes away.
  let prefixes = [];
  cleanups.push(async () => { /* placeholder so ordering below is explicit */ });
  const collectPrefixes = () => {
    try { prefixes = psql(`select distinct split_part("ObjectKey", '/', 1) from learning_assets`).split("\n").filter(Boolean); } catch { /* no table yet */ }
  };

  // ── 2. the API ───────────────────────────────────────────────────────
  log(`starting the API on :${apiPort} (Development, dev bucket, presigned lifetime 30 s)`);
  start("api", "dotnet", ["run", "--project", apiProject, "--no-launch-profile"], {
    cwd: apiProject,
    env: cleanEnv({
      ASPNETCORE_ENVIRONMENT: "Development",
      ASPNETCORE_URLS: `http://localhost:${apiPort}`,
      ConnectionStrings__PlatformDB: `Host=localhost;Port=${pgPort};Database=platformdb;Username=postgres;Password=e2e`,
      Storage__PresignedReadLifetimeSeconds: "30",
      Storage__R2__Bucket: DEV_BUCKET,
      Email__Enabled: "false",
    }),
  });
  await waitFor(async () => (await fetch(`http://localhost:${apiPort}/health`)).ok, "the API", 180_000);

  // ── 3. the built frontend ────────────────────────────────────────────
  log("building the frontend");
  const build = spawnSync("npm", ["run", "build"], { cwd: frontend, stdio: "ignore" });
  if (build.status !== 0) throw new Error("The frontend build failed.");
  log(`serving the build on :${webPort}`);
  start("web", "npx", ["vite", "preview", "--port", String(webPort), "--strictPort", "--host", "localhost"], {
    cwd: frontend, env: cleanEnv({ services__api__http__0: `http://localhost:${apiPort}` }),
  });
  await waitFor(async () => (await fetch(`http://localhost:${webPort}/`)).ok, "the frontend");

  // ── 4. seed, then test ───────────────────────────────────────────────
  log("seeding a tutor and a lesson video through the API");
  const seeded = await seedTutorWithVideo({
    apiBase: `http://localhost:${apiPort}`, runId,
    videoBytes: fs.readFileSync(videoPath), videoName: path.basename(videoPath),
  });
  collectPrefixes();

  log("running the browser test");
  const test = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
    cwd: frontend, stdio: "inherit",
    env: cleanEnv({
      E2E_BASE_URL: `http://localhost:${webPort}`,
      E2E_API_BASE: `http://localhost:${apiPort}`,
      E2E_SESSION: JSON.stringify(seeded.session),
      E2E_SLUG: seeded.slug,
      E2E_ASSET_ID: seeded.assetId,
      E2E_LIFETIME_SECONDS: "30",
    }),
  });
  collectPrefixes();
  return { exitCode: test.status ?? 1, getPrefixes: () => prefixes, collectPrefixes };
}

let outcome = { exitCode: 1, getPrefixes: () => [] };
try {
  outcome = await main();
} catch (error) {
  console.error(`[e2e ${runId}] FAILED: ${error.message}`);
} finally {
  // Delete every object this run put in the dev bucket, whatever happened above.
  try { outcome.collectPrefixes?.(); } catch { /* keep going */ }
  const prefixes = (outcome.getPrefixes?.() ?? []).filter((p) => /^[0-9a-f]{32}$/.test(p));
  for (const undo of cleanups.reverse()) { try { await undo(); } catch { /* keep going */ } }
  if (prefixes.length > 0) {
    log(`deleting the test objects under ${prefixes.length} prefix(es) in ${DEV_BUCKET}`);
    const creds = devR2Credentials();
    const cleanup = spawnSync("dotnet", ["test", testProject, "--filter", "FullyQualifiedName~R2E2ECleanup", "--nologo"], {
      stdio: "ignore",
      env: cleanEnv({
        R2_ACCOUNT_ID: "08192a3fefa2826cd88b89bf7bab6643", R2_BUCKET: DEV_BUCKET,
        R2_ACCESS_KEY_ID: creds.accessKey, R2_SECRET_ACCESS_KEY: creds.secret,
        R2_E2E_CLEANUP_PREFIXES: prefixes.map((p) => `${p}/`).join(","),
      }),
    });
    log(cleanup.status === 0 ? "test objects deleted and verified gone" : "CLEANUP FAILED — delete the prefixes above from the dev bucket by hand");
    if (cleanup.status !== 0) outcome.exitCode = outcome.exitCode || 1;
  } else {
    log("no objects were uploaded, so nothing to delete");
  }
  log(outcome.exitCode === 0 ? "PASSED" : "did not pass");
  process.exit(outcome.exitCode);
}
