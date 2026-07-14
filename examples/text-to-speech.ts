/**
 * Convert text to speech and play the result.
 *
 * Requires the ELEVENLABS_API_KEY environment variable and ffplay (ffmpeg)
 * to be installed for audio playback. Set ELEVENLABS_SKIP_PLAYBACK=1 to write
 * the audio to output.mp3 instead of playing it (useful on headless machines).
 *
 * Run with: npx ts-node -P examples/tsconfig.json examples/text-to-speech.ts
 */
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";

async function main(): Promise<void> {
    const client = new ElevenLabsClient(
        process.env.ELEVENLABS_BASE_URL ? { baseUrl: process.env.ELEVENLABS_BASE_URL } : {},
    );

    const audio = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
        text: "The first move is what sets everything in motion.",
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
    });

    if (process.env.ELEVENLABS_SKIP_PLAYBACK) {
        await pipeline(
            Readable.fromWeb(audio as import("node:stream/web").ReadableStream),
            createWriteStream("output.mp3"),
        );
        console.log("Wrote audio to output.mp3");
    } else {
        await play(audio);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
