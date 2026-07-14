import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock `ws` before importing ScribeRealtime so it never opens a real socket.
let capturedUrl: string | undefined;
jest.mock("ws", () => {
    return {
        __esModule: true,
        default: class FakeWebSocket {
            static OPEN = 1;
            readyState = 0;
            constructor(url: string) {
                capturedUrl = url;
            }
            on() {}
            send() {}
            close() {}
        },
    };
});

import { AudioFormat, ScribeRealtime } from "../../../src/wrapper/realtime/scribe";

const TEST_API_KEY = "test_api_key";
const TEST_MODEL_ID = "scribe_v2_realtime";

function connect(overrides: Record<string, unknown> = {}, apiKey: string | null = TEST_API_KEY) {
    const scribe = new ScribeRealtime(apiKey === null ? {} : { apiKey });
    return scribe.connect({
        modelId: TEST_MODEL_ID,
        audioFormat: AudioFormat.PCM_16000,
        sampleRate: 16000,
        ...overrides,
    } as Parameters<ScribeRealtime["connect"]>[0]);
}

describe("ScribeRealtime error messages", () => {
    beforeEach(() => {
        capturedUrl = undefined;
    });

    it("throws an actionable error when the API key is missing", async () => {
        await expect(connect({}, null)).rejects.toThrow(/Missing ElevenLabs API key/);
        await expect(connect({}, null)).rejects.toThrow(/ELEVENLABS_API_KEY/);
    });

    it("throws an actionable error when modelId is missing", async () => {
        await expect(connect({ modelId: "" })).rejects.toThrow(/modelId is required/);
        await expect(connect({ modelId: "" })).rejects.toThrow(/scribe_v2_realtime/);
    });

    it("includes the received value when vadSilenceThresholdSecs is out of range", async () => {
        await expect(connect({ vadSilenceThresholdSecs: 5 })).rejects.toThrow(
            /vadSilenceThresholdSecs must be between 0.3 and 3.0, but received 5/,
        );
    });

    it("includes the received value when vadThreshold is out of range", async () => {
        await expect(connect({ vadThreshold: 0.95 })).rejects.toThrow(
            /vadThreshold must be between 0.1 and 0.9, but received 0.95/,
        );
    });

    it("includes the received value when minSpeechDurationMs is out of range", async () => {
        await expect(connect({ minSpeechDurationMs: 5000 })).rejects.toThrow(
            /minSpeechDurationMs must be between 50 and 2000, but received 5000/,
        );
    });

    it("includes the received value when minSilenceDurationMs is out of range", async () => {
        await expect(connect({ minSilenceDurationMs: 10 })).rejects.toThrow(
            /minSilenceDurationMs must be between 50 and 2000, but received 10/,
        );
    });
});

describe("ScribeRealtime URI building", () => {
    beforeEach(() => {
        capturedUrl = undefined;
    });

    it("appends audio_format exactly once", async () => {
        const connection = await connect();
        connection.close();
        expect(capturedUrl).toBeDefined();
        const url = new URL(capturedUrl as string);
        expect(url.searchParams.getAll("audio_format")).toEqual([AudioFormat.PCM_16000]);
    });

    it("converts an https baseUrl to wss", async () => {
        const scribe = new ScribeRealtime({ apiKey: TEST_API_KEY, baseUrl: "https://example.com" });
        const connection = await scribe.connect({
            modelId: TEST_MODEL_ID,
            audioFormat: AudioFormat.PCM_16000,
            sampleRate: 16000,
        });
        connection.close();
        expect(capturedUrl).toMatch(/^wss:\/\/example\.com\/v1\/speech-to-text\/realtime/);
    });

    it("converts an http baseUrl to ws", async () => {
        const scribe = new ScribeRealtime({ apiKey: TEST_API_KEY, baseUrl: "http://localhost:8080" });
        const connection = await scribe.connect({
            modelId: TEST_MODEL_ID,
            audioFormat: AudioFormat.PCM_16000,
            sampleRate: 16000,
        });
        connection.close();
        expect(capturedUrl).toMatch(/^ws:\/\/localhost:8080\/v1\/speech-to-text\/realtime/);
    });
});
