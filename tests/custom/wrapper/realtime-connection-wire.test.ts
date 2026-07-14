/**
 * Wire tests for the realtime Scribe connection lifecycle.
 *
 * A real `ws` WebSocketServer is started on an ephemeral local port and
 * ScribeRealtime connects to it, so the full handshake, message parsing,
 * event fan-out, and close/cleanup paths are exercised over an actual socket.
 */

import type { IncomingMessage } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";
import type {
    CommittedTranscriptMessage,
    CommittedTranscriptWithTimestampsMessage,
    InputAudioChunk,
    PartialTranscriptMessage,
    RealtimeErrorPayload,
    ServerErrorMessage,
    SessionStartedMessage,
} from "../../../src/wrapper/realtime/connection";
import { type RealtimeConnection, RealtimeEvents } from "../../../src/wrapper/realtime/connection";
import { AudioFormat, CommitStrategy, ScribeRealtime } from "../../../src/wrapper/realtime/scribe";

const TEST_API_KEY = "wire-test-api-key";
const TEST_MODEL_ID = "scribe_v2_realtime";

function waitFor<T>(register: (resolve: (value: T) => void) => void, timeoutMs = 5000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for event")), timeoutMs);
        register((value) => {
            clearTimeout(timer);
            resolve(value);
        });
    });
}

describe("RealtimeConnection wire tests", () => {
    let server: WebSocketServer;
    let port: number;
    let serverSockets: WebSocket[];
    let upgradeRequests: IncomingMessage[];
    let connections: RealtimeConnection[];

    beforeEach(async () => {
        serverSockets = [];
        upgradeRequests = [];
        connections = [];
        server = new WebSocketServer({ port: 0 });
        server.on("connection", (socket, request) => {
            serverSockets.push(socket);
            upgradeRequests.push(request);
        });
        await waitFor<void>((resolve) => server.on("listening", () => resolve()));
        const address = server.address();
        if (address === null || typeof address === "string") {
            throw new Error("Expected the mock WebSocket server to listen on a TCP port");
        }
        port = address.port;
    });

    afterEach(async () => {
        for (const connection of connections) {
            connection.close();
        }
        for (const socket of serverSockets) {
            socket.terminate();
        }
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    async function connect(
        overrides: Partial<Parameters<ScribeRealtime["connect"]>[0]> = {},
    ): Promise<RealtimeConnection> {
        const scribe = new ScribeRealtime({ apiKey: TEST_API_KEY, baseUrl: `http://127.0.0.1:${port}` });
        const connection = await scribe.connect({
            modelId: TEST_MODEL_ID,
            audioFormat: AudioFormat.PCM_16000,
            sampleRate: 16000,
            ...overrides,
        } as Parameters<ScribeRealtime["connect"]>[0]);
        connections.push(connection);
        return connection;
    }

    async function openConnection(): Promise<{ connection: RealtimeConnection; serverSocket: WebSocket }> {
        const connection = await connect();
        await waitFor<void>((resolve) => connection.on(RealtimeEvents.OPEN, () => resolve()));
        return { connection, serverSocket: serverSockets[0] };
    }

    describe("connection lifecycle", () => {
        it("opens the connection and emits OPEN", async () => {
            const connection = await connect();
            await waitFor<void>((resolve) => connection.on(RealtimeEvents.OPEN, () => resolve()));
        });

        it("sends the xi-api-key header and query parameters during the handshake", async () => {
            const connection = await connect({ commitStrategy: CommitStrategy.MANUAL, languageCode: "en" });
            await waitFor<void>((resolve) => connection.on(RealtimeEvents.OPEN, () => resolve()));

            const request = upgradeRequests[0];
            expect(request.headers["xi-api-key"]).toBe(TEST_API_KEY);

            const url = new URL(request.url as string, `http://127.0.0.1:${port}`);
            expect(url.pathname).toBe("/v1/speech-to-text/realtime");
            expect(url.searchParams.get("model_id")).toBe(TEST_MODEL_ID);
            expect(url.searchParams.get("audio_format")).toBe(AudioFormat.PCM_16000);
            expect(url.searchParams.get("commit_strategy")).toBe(CommitStrategy.MANUAL);
            expect(url.searchParams.get("language_code")).toBe("en");
        });

        it("emits CLOSE when the client closes the connection", async () => {
            const { connection } = await openConnection();
            const closed = waitFor<void>((resolve) => connection.on(RealtimeEvents.CLOSE, () => resolve()));
            connection.close();
            await closed;
        });

        it("emits CLOSE when the server closes the connection", async () => {
            const { connection, serverSocket } = await openConnection();
            const closed = waitFor<void>((resolve) => connection.on(RealtimeEvents.CLOSE, () => resolve()));
            serverSocket.close();
            await closed;
        });
    });

    describe("server message handling", () => {
        it("emits SESSION_STARTED with the parsed payload", async () => {
            const { connection, serverSocket } = await openConnection();
            const message: SessionStartedMessage = {
                message_type: "session_started",
                session_id: "session_123",
                config: { sample_rate: 16000, model_id: TEST_MODEL_ID },
            };

            const received = waitFor<SessionStartedMessage>((resolve) =>
                connection.on(RealtimeEvents.SESSION_STARTED, resolve),
            );
            serverSocket.send(JSON.stringify(message));
            expect(await received).toEqual(message);
        });

        it("emits PARTIAL_TRANSCRIPT and COMMITTED_TRANSCRIPT in order", async () => {
            const { connection, serverSocket } = await openConnection();
            const partial: PartialTranscriptMessage = { message_type: "partial_transcript", text: "Hel" };
            const committed: CommittedTranscriptMessage = { message_type: "committed_transcript", text: "Hello." };

            const events: string[] = [];
            const receivedPartial = waitFor<PartialTranscriptMessage>((resolve) =>
                connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
                    events.push(data.message_type);
                    resolve(data);
                }),
            );
            const receivedCommitted = waitFor<CommittedTranscriptMessage>((resolve) =>
                connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
                    events.push(data.message_type);
                    resolve(data);
                }),
            );

            serverSocket.send(JSON.stringify(partial));
            serverSocket.send(JSON.stringify(committed));

            expect(await receivedPartial).toEqual(partial);
            expect(await receivedCommitted).toEqual(committed);
            expect(events).toEqual(["partial_transcript", "committed_transcript"]);
        });

        it("emits COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS with word timings", async () => {
            const { connection, serverSocket } = await openConnection();
            const message: CommittedTranscriptWithTimestampsMessage = {
                message_type: "committed_transcript_with_timestamps",
                text: "Hello.",
                language_code: "en",
                words: [{ text: "Hello.", start: 0, end: 0.5, type: "word" }],
            };

            const received = waitFor<CommittedTranscriptWithTimestampsMessage>((resolve) =>
                connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS, resolve),
            );
            serverSocket.send(JSON.stringify(message));
            expect(await received).toEqual(message);
        });

        it.each([
            ["auth_error", RealtimeEvents.AUTH_ERROR],
            ["quota_exceeded", RealtimeEvents.QUOTA_EXCEEDED],
            ["commit_throttled", RealtimeEvents.COMMIT_THROTTLED],
            ["transcriber_error", RealtimeEvents.TRANSCRIBER_ERROR],
            ["unaccepted_terms_error", RealtimeEvents.UNACCEPTED_TERMS_ERROR],
            ["rate_limited", RealtimeEvents.RATE_LIMITED],
            ["input_error", RealtimeEvents.INPUT_ERROR],
            ["queue_overflow", RealtimeEvents.QUEUE_OVERFLOW],
            ["resource_exhausted", RealtimeEvents.RESOURCE_EXHAUSTED],
            ["session_time_limit_exceeded", RealtimeEvents.SESSION_TIME_LIMIT_EXCEEDED],
            ["chunk_size_exceeded", RealtimeEvents.CHUNK_SIZE_EXCEEDED],
            ["insufficient_audio_activity", RealtimeEvents.INSUFFICIENT_AUDIO_ACTIVITY],
        ] as const)("emits both %s and ERROR for a %s message", async (messageType, event) => {
            const { connection, serverSocket } = await openConnection();
            const message = { message_type: messageType, error: `${messageType} details` } as ServerErrorMessage;

            const receivedSpecific = waitFor<ServerErrorMessage>((resolve) => connection.on(event, resolve));
            const receivedGeneric = waitFor<RealtimeErrorPayload>((resolve) =>
                connection.on(RealtimeEvents.ERROR, resolve),
            );

            serverSocket.send(JSON.stringify(message));
            expect(await receivedSpecific).toEqual(message);
            expect(await receivedGeneric).toEqual(message);
        });

        it("emits only ERROR for a generic error message", async () => {
            const { connection, serverSocket } = await openConnection();
            const message: ServerErrorMessage = { message_type: "error", error: "something went wrong" };

            const received = waitFor<RealtimeErrorPayload>((resolve) => connection.on(RealtimeEvents.ERROR, resolve));
            serverSocket.send(JSON.stringify(message));
            expect(await received).toEqual(message);
        });
    });

    describe("client message sending", () => {
        it("sends an input_audio_chunk with the configured sample rate", async () => {
            const { connection, serverSocket } = await openConnection();
            const received = waitFor<InputAudioChunk>((resolve) =>
                serverSocket.on("message", (data) => resolve(JSON.parse(data.toString()) as InputAudioChunk)),
            );

            connection.send({ audioBase64: "c29tZSBhdWRpbw==" });

            expect(await received).toEqual({
                message_type: "input_audio_chunk",
                audio_base_64: "c29tZSBhdWRpbw==",
                commit: false,
                sample_rate: 16000,
            });
        });

        it("honors per-chunk overrides for commit, sampleRate, and previousText", async () => {
            const { connection, serverSocket } = await openConnection();
            const received = waitFor<InputAudioChunk>((resolve) =>
                serverSocket.on("message", (data) => resolve(JSON.parse(data.toString()) as InputAudioChunk)),
            );

            connection.send({ audioBase64: "YXVkaW8=", commit: true, sampleRate: 8000, previousText: "Previously." });

            expect(await received).toEqual({
                message_type: "input_audio_chunk",
                audio_base_64: "YXVkaW8=",
                commit: true,
                sample_rate: 8000,
                previous_text: "Previously.",
            });
        });

        it("commit() sends an empty committing chunk", async () => {
            const { connection, serverSocket } = await openConnection();
            const received = waitFor<InputAudioChunk>((resolve) =>
                serverSocket.on("message", (data) => resolve(JSON.parse(data.toString()) as InputAudioChunk)),
            );

            connection.commit();

            expect(await received).toEqual({
                message_type: "input_audio_chunk",
                audio_base_64: "",
                commit: true,
                sample_rate: 16000,
            });
        });

        it("throws when sending after the connection is closed", async () => {
            const { connection } = await openConnection();
            const closed = waitFor<void>((resolve) => connection.on(RealtimeEvents.CLOSE, () => resolve()));
            connection.close();
            await closed;

            expect(() => connection.send({ audioBase64: "YXVkaW8=" })).toThrow(/WebSocket is not connected/);
            expect(() => connection.commit()).toThrow(/WebSocket is not connected/);
        });
    });
});
