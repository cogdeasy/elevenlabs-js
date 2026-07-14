/**
 * Stream text to speech and write chunks to a file as they arrive.
 *
 * Requires the ELEVENLABS_API_KEY environment variable.
 *
 * Run with: npx ts-node -P examples/tsconfig.json examples/text-to-speech-streaming.ts
 */
import { createWriteStream } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

async function main(): Promise<void> {
    const client = new ElevenLabsClient();

    const audioStream = await client.textToSpeech.stream("JBFqnCBsd6RMkjVDRZzb", {
        text: "Streaming lets you start playback before the full audio is generated.",
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
    });

    const output = createWriteStream("output.mp3");
    const reader = audioStream.getReader();
    let bytes = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        bytes += value.length;
        output.write(value);
    }
    output.end();

    console.log(`Wrote ${bytes} bytes to output.mp3`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
