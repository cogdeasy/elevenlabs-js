/**
 * Smoke-runs the examples against a local mock of the ElevenLabs API, so CI
 * can verify they actually execute (not just type-check) without API keys.
 *
 * Run with: node examples/smoke/run.mjs
 *
 * examples/speech-engine-server.ts is excluded: it starts a long-running
 * WebSocket server and is covered by type-checking and the speech-engine
 * test suites instead.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMockServer } from "./mock-server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const EXAMPLES = ["text-to-speech.ts", "text-to-speech-streaming.ts", "speech-to-text.ts", "webhooks.ts"];

function runExample(example, env, cwd) {
    return new Promise((resolve, reject) => {
        const tsconfig = path.join(repoRoot, "examples", "tsconfig.json");
        const child = spawn(
            "npx",
            [
                "--yes",
                "ts-node",
                "-P",
                tsconfig,
                "-r",
                path.join(repoRoot, "examples", "smoke", "register-alias.cjs"),
                path.join(repoRoot, "examples", example),
            ],
            { stdio: "inherit", env, cwd },
        );
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${example} exited with code ${code}`));
            }
        });
    });
}

const { url, close } = await startMockServer();
console.log(`Mock ElevenLabs API listening at ${url}`);

// Examples write output files (e.g. output.mp3) to the working directory.
const workDir = mkdtempSync(path.join(tmpdir(), "elevenlabs-examples-smoke-"));

const env = {
    ...process.env,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? "smoke-test-key",
    ELEVENLABS_BASE_URL: url,
    ELEVENLABS_SKIP_PLAYBACK: "1",
};

let failures = 0;
for (const example of EXAMPLES) {
    console.log(`\n=== Running examples/${example} ===`);
    try {
        await runExample(example, env, workDir);
        console.log(`=== examples/${example} OK ===`);
    } catch (error) {
        failures += 1;
        console.error(`=== examples/${example} FAILED: ${error.message} ===`);
    }
}

await close();

if (failures > 0) {
    console.error(`\n${failures} of ${EXAMPLES.length} examples failed`);
    process.exit(1);
}
console.log(`\nAll ${EXAMPLES.length} examples ran successfully`);
