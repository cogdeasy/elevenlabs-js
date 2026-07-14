/**
 * Run a Speech Engine WebSocket server that echoes each user transcript back
 * as an agent response.
 *
 * Requires the ELEVENLABS_API_KEY environment variable. Incoming connections
 * from the ElevenLabs API are verified against your API key.
 *
 * Run with: npx ts-node -P examples/tsconfig.json examples/speech-engine-server.ts
 */
import { SpeechEngine } from "@elevenlabs/elevenlabs-js";

const PORT = 3001;

const server = new SpeechEngine.Server({
    port: PORT,
    onInit(conversationId) {
        console.log(`Session started: ${conversationId}`);
    },
    onTranscript(transcript, _signal, session) {
        const lastMessage = transcript[transcript.length - 1];
        console.log(`User said: ${lastMessage.content}`);
        session.sendResponse(`You said: ${lastMessage.content}`);
    },
    onClose(session) {
        console.log(`Session closed: ${session.conversationId}`);
    },
    onError(error) {
        console.error("Session error:", error.message);
    },
});

server.start();
console.log(`Speech Engine server listening on ws://localhost:${PORT}`);
