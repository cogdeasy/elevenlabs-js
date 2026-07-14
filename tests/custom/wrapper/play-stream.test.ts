import { describe, expect, it, jest } from "@jest/globals";

jest.mock("command-exists", () => ({
    __esModule: true,
    default: { sync: () => false },
}));

import { play, stream } from "../../../src";
import { ElevenLabsError } from "../../../src/errors";

async function* emptyAudio(): AsyncIterable<Uint8Array> {}

function emptyStream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            controller.close();
        },
    });
}

describe("play", () => {
    it("throws an actionable ElevenLabsError when ffplay is not installed", async () => {
        await expect(play(emptyAudio())).rejects.toBeInstanceOf(ElevenLabsError);
        await expect(play(emptyAudio())).rejects.toThrow(/ffplay from ffmpeg not found/);
        await expect(play(emptyAudio())).rejects.toThrow(/brew install ffmpeg/);
        await expect(play(emptyAudio())).rejects.toThrow(/ffmpeg\.org/);
    });
});

describe("stream", () => {
    it("throws an actionable ElevenLabsError when mpv is not installed", async () => {
        await expect(stream(emptyStream())).rejects.toBeInstanceOf(ElevenLabsError);
        await expect(stream(emptyStream())).rejects.toThrow(/mpv not found/);
        await expect(stream(emptyStream())).rejects.toThrow(/brew install mpv/);
        await expect(stream(emptyStream())).rejects.toThrow(/mpv\.io/);
    });
});
