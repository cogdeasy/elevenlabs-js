/**
 * Transcribe an audio file with Scribe.
 *
 * Requires the ELEVENLABS_API_KEY environment variable. Set AUDIO_FILE to
 * transcribe your own recording; otherwise a short generated WAV is used so
 * the example runs without any local assets.
 *
 * Run with: npx ts-node -P examples/tsconfig.json examples/speech-to-text.ts
 */
import { readFileSync } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/** Builds a one-second 16kHz mono PCM WAV file of silence in memory. */
function generateSilentWav(): Buffer {
    const sampleRate = 16000;
    const numSamples = sampleRate; // one second
    const dataSize = numSamples * 2; // 16-bit samples
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // byte rate
    header.writeUInt16LE(2, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, Buffer.alloc(dataSize)]);
}

async function main(): Promise<void> {
    const client = new ElevenLabsClient(
        process.env.ELEVENLABS_BASE_URL ? { baseUrl: process.env.ELEVENLABS_BASE_URL } : {},
    );

    const audio = process.env.AUDIO_FILE ? readFileSync(process.env.AUDIO_FILE) : generateSilentWav();

    const transcription = await client.speechToText.convert({
        file: audio,
        modelId: "scribe_v1",
        tagAudioEvents: false,
        diarize: false,
    });

    console.log("Language:", transcription.languageCode);
    console.log("Transcript:", transcription.text);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
