import { describe, expect, it } from "@jest/globals";
import { ElevenLabsClient } from "../../../src";
import * as errors from "../../../src/errors";
import { Music } from "../../../src/wrapper/music";
import { SpeechEngineClientWrapper } from "../../../src/wrapper/speech-engine";
import { SpeechToText } from "../../../src/wrapper/speechToText";
import { WebhooksClient } from "../../../src/wrapper/webhooks";

describe("ElevenLabsClient construction", () => {
    const originalEnv = process.env.ELEVENLABS_API_KEY;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.ELEVENLABS_API_KEY;
        } else {
            process.env.ELEVENLABS_API_KEY = originalEnv;
        }
    });

    it("throws an actionable error when no API key is provided", () => {
        delete process.env.ELEVENLABS_API_KEY;
        expect(() => new ElevenLabsClient()).toThrow(errors.ElevenLabsError);
        expect(() => new ElevenLabsClient()).toThrow(/Missing ElevenLabs API key/);
        expect(() => new ElevenLabsClient()).toThrow(/ELEVENLABS_API_KEY/);
        expect(() => new ElevenLabsClient()).toThrow(/apiKey/);
    });

    it("accepts an explicit apiKey option", () => {
        delete process.env.ELEVENLABS_API_KEY;
        expect(() => new ElevenLabsClient({ apiKey: "test-key" })).not.toThrow();
    });

    it("falls back to the ELEVENLABS_API_KEY environment variable", () => {
        process.env.ELEVENLABS_API_KEY = "env-key";
        expect(() => new ElevenLabsClient()).not.toThrow();
    });

    it("exposes the hand-written wrapper sub-clients", () => {
        const client = new ElevenLabsClient({ apiKey: "test-key" });
        expect(client.webhooks).toBeInstanceOf(WebhooksClient);
        expect(client.music).toBeInstanceOf(Music);
        expect(client.speechToText).toBeInstanceOf(SpeechToText);
        expect(client.speechEngine).toBeInstanceOf(SpeechEngineClientWrapper);
    });

    it("memoizes the wrapper sub-clients", () => {
        const client = new ElevenLabsClient({ apiKey: "test-key" });
        expect(client.webhooks).toBe(client.webhooks);
        expect(client.music).toBe(client.music);
        expect(client.speechToText).toBe(client.speechToText);
        expect(client.speechEngine).toBe(client.speechEngine);
    });
});
