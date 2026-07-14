import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { ElevenLabsClient } from "../../../src";
import { SpeechEngineResource } from "../../../src/wrapper/speech-engine";
import { mockServerPool } from "../../mock-server/MockServerPool";

// Full valid speech engine response body, mirrored from tests/wire/speechEngine.test.ts.
const RAW_SPEECH_ENGINE_BODY = {
    speech_engine_id: "seng_123",
    name: "My Speech Engine",
    speech_engine: { ws_url: "wss://example.com/transcript", request_headers: { key: "value" } },
    asr: {
        quality: "high",
        provider: "elevenlabs",
        user_input_audio_format: "pcm_16000",
        keywords: ["keywords"],
    },
    tts: {
        model_id: "eleven_flash_v2",
        voice_id: "cjVigY5qzO86Huf0OWal",
        supported_voices: [{ label: "label", voice_id: "voice_id" }],
        expressive_mode: true,
        suggested_audio_tags: [{ tag: "tag" }],
        agent_output_audio_format: "pcm_16000",
        optimize_streaming_latency: 3,
        stability: 0.5,
        speed: 1,
        similarity_boost: 0.8,
        text_normalisation_type: "system_prompt",
        pronunciation_dictionary_locators: [{ pronunciation_dictionary_id: "pronunciation_dictionary_id" }],
        enable_phoneme_tags: true,
    },
    turn: {
        turn_timeout: 7,
        initial_wait_time: 1.1,
        silence_end_call_timeout: -1,
        turn_eagerness: "normal",
        spelling_patience: "auto",
        speculative_turn: true,
        retranscribe_on_turn_timeout: true,
        turn_model: "turn_v2",
        interruption_ignore_terms: ["interruption_ignore_terms"],
        interruption_ignore_term_languages: ["interruption_ignore_term_languages"],
        transcribe_on_disabled_interruptions: true,
    },
    conversation: {
        text_only: true,
        max_duration_seconds: 600,
        client_events: ["audio", "interruption", "agent_response", "user_transcript"],
        file_input: { enabled: true, max_files_per_conversation: 1 },
        monitoring_enabled: true,
        monitoring_events: ["conversation_initiation_metadata"],
        background_sound: { source_type: "preset", source_id: "office2", volume: 1.1, crossfade_loop: true },
        source_attribution: true,
    },
    privacy: {
        record_voice: true,
        retention_days: -1,
        delete_transcript_and_pii: false,
        delete_audio: false,
        apply_to_existing_conversations: false,
        zero_retention_mode: false,
        conversation_history_redaction: { enabled: true, entities: ["name"] },
    },
    call_limits: { agent_concurrency_limit: -1, daily_limit: 100000, bursting_enabled: true },
    language: "en",
    tags: ["production", "v1"],
    overrides: { first_message: false },
    metadata: {
        created_at_unix_secs: 1714000000,
        updated_at_unix_secs: 1714000000,
        created_from: "api",
        last_updated_from: "api",
    },
    access_info: {
        is_creator: true,
        creator_name: "John Doe",
        creator_email: "john.doe@example.com",
        role: "admin",
        anonymous_access_level_override: "admin",
        access_source: "creator",
    },
};

// Wire tests for the hand-written wrapper client: requests are served by a
// local msw mock server, so no real API key or network access is required.
describe("ElevenLabsClient wire tests", () => {
    beforeAll(() => {
        mockServerPool.listen();
    });

    afterAll(() => {
        mockServerPool.close();
    });

    it("sends the xi-api-key header on requests", async () => {
        const server = mockServerPool.createServer();
        const client = new ElevenLabsClient({ maxRetries: 0, apiKey: "wire-test-key", environment: server.baseUrl });

        server
            .mockEndpoint()
            .get("/v1/models")
            .header("xi-api-key", "wire-test-key")
            .respondWith()
            .statusCode(200)
            .jsonBody([])
            .build();

        const models = await client.models.list();
        expect(models).toEqual([]);
    });

    it("speechEngine.get returns a SpeechEngineResource with server helpers", async () => {
        const server = mockServerPool.createServer();
        const client = new ElevenLabsClient({ maxRetries: 0, apiKey: "wire-test-key", environment: server.baseUrl });

        server
            .mockEndpoint()
            .get("/v1/speech-engine/seng_123")
            .respondWith()
            .statusCode(200)
            .jsonBody(RAW_SPEECH_ENGINE_BODY)
            .build();

        const engine = await client.speechEngine.get("seng_123");
        expect(engine).toBeInstanceOf(SpeechEngineResource);
        expect(typeof engine.attach).toBe("function");
        expect(typeof engine.createSession).toBe("function");
    });

    it("surfaces API error responses from the server", async () => {
        const server = mockServerPool.createServer();
        const client = new ElevenLabsClient({ maxRetries: 0, apiKey: "wire-test-key", environment: server.baseUrl });

        server
            .mockEndpoint()
            .get("/v1/speech-engine/seng_missing")
            .respondWith()
            .statusCode(422)
            .jsonBody({ detail: [{ loc: ["path"], msg: "not found", type: "value_error" }] })
            .build();

        await expect(client.speechEngine.get("seng_missing")).rejects.toThrow();
    });
});
