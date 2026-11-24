// Runs Vitest with two small workarounds for this project's environment:
// 1. /storage/emulated/0 is mounted noexec, so esbuild is copied to the temp folder.
// 2. Vitest + esbuild cannot resolve absolute paths while the cwd is on that mount,
//    so Vitest runs from the temp folder with an explicit --root.
// On a normal machine both steps are harmless.
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const candidates = [
  `node_modules/@esbuild/${process.platform}-${process.arch}/bin/esbuild`,
  `node_modules/@esbuild/${process.platform}-${process.arch}-musl/bin/esbuild`,
  "node_modules/esbuild/bin/esbuild",
].map((candidate) => path.join(projectRoot, candidate));

const local = candidates.find((candidate) => existsSync(candidate));
let cleanup = () => {};

if (local) {
  const probe = spawnSync(local, ["--version"], { stdio: "ignore" });
  if (probe.status !== 0) {
    const target = path.join(os.tmpdir(), `esbuild-${process.pid}`);
    copyFileSync(local, target);
    chmodSync(target, 0o755);
    process.env.ESBUILD_BINARY_PATH = target;
    cleanup = () => {
      try {
        rmSync(target, { force: true });
      } catch {
        // ignore
      }
    };
    console.log(`[test] esbuild copied to ${target} (project storage is noexec)`);
  }
}

const vitest = path.join(projectRoot, "node_modules/vitest/vitest.mjs");
const args = [vitest, "run", "--root", projectRoot, ...process.argv.slice(2)];

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
  cwd: os.tmpdir(),
});

child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
