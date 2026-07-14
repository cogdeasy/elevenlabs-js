/**
 * Preload shim (node -r) that resolves "@elevenlabs/elevenlabs-js" to the
 * local SDK source, mirroring the "paths" mapping in examples/tsconfig.json
 * so the examples can be executed with ts-node without publishing the SDK.
 */
const path = require("node:path");
const Module = require("node:module");

const repoRoot = path.resolve(__dirname, "..", "..");
const entrypoint = path.join(repoRoot, "src", "index.ts");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === "@elevenlabs/elevenlabs-js") {
        return originalResolveFilename.call(this, entrypoint, ...rest);
    }
    return originalResolveFilename.call(this, request, ...rest);
};
