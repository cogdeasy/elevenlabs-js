/**
 * Convert text to speech and play the result.
 *
 * Requires the ELEVENLABS_API_KEY environment variable and ffplay (ffmpeg)
 * to be installed for audio playback.
 *
 * Run with: npx ts-node -P examples/tsconfig.json examples/text-to-speech.ts
 */
import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";

async function main(): Promise<void> {
    const client = new ElevenLabsClient();

    const audio = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
        text: "The first move is what sets everything in motion.",
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
    });

    await play(audio);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
