/**
 * Minimal mock of the ElevenLabs API used to smoke-run the examples without
 * real API keys or network access. Covers just the endpoints the examples
 * call: text-to-speech (plain + streaming) and speech-to-text.
 *
 * Start standalone with: node examples/smoke/mock-server.mjs
 * Or import { startMockServer } from the smoke runner.
 */
import http from "node:http";

const FAKE_AUDIO = Buffer.from("ID3 fake mp3 payload for smoke tests ".repeat(64));

const STT_RESPONSE = {
    language_code: "en",
    language_probability: 0.98,
    text: "Hello world!",
    words: [
        { text: "Hello", start: 0, end: 0.5, type: "word", logprob: -0.1 },
        { text: " ", start: 0.5, end: 0.5, type: "spacing", logprob: 0 },
        { text: "world!", start: 0.5, end: 1.2, type: "word", logprob: -0.05 },
    ],
};

export function startMockServer() {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        const apiKey = req.headers["xi-api-key"];

        // Drain the request body before responding.
        req.on("data", () => {});
        req.on("end", () => {
            if (!apiKey) {
                res.writeHead(401, { "content-type": "application/json" });
                res.end(JSON.stringify({ detail: { status: "missing_api_key", message: "Missing xi-api-key" } }));
                return;
            }

            if (req.method === "POST" && /^\/v1\/text-to-speech\/[^/]+(\/stream)?$/.test(url.pathname)) {
                res.writeHead(200, { "content-type": "audio/mpeg" });
                res.end(FAKE_AUDIO);
                return;
            }

            if (req.method === "POST" && url.pathname === "/v1/speech-to-text") {
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify(STT_RESPONSE));
                return;
            }

            res.writeHead(404, { "content-type": "application/json" });
            res.end(JSON.stringify({ detail: `No mock for ${req.method} ${url.pathname}` }));
        });
    });

    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            resolve({
                url: `http://127.0.0.1:${port}`,
                close: () => new Promise((done) => server.close(done)),
            });
        });
    });
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
    const { url } = await startMockServer();
    console.log(`Mock ElevenLabs API listening at ${url}`);
}
