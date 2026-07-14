/**
 * Verify an ElevenLabs webhook payload.
 *
 * Shows how to use client.webhooks.constructEvent to verify the
 * ElevenLabs-Signature header on an incoming webhook request. This example
 * signs a sample payload locally so it runs without any network access.
 *
 * Run with: npx ts-node -P examples/tsconfig.json examples/webhooks.ts
 */
import { createHmac } from "node:crypto";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET ?? "wsec_example_secret";

/** Signs a payload the same way ElevenLabs does when calling your webhook. */
function signPayload(rawBody: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    return `t=${timestamp},v0=${signature}`;
}

async function main(): Promise<void> {
    const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY ?? "unused-for-verification" });

    // In a real server these come from the incoming HTTP request:
    //   const rawBody = req.rawBody; const sigHeader = req.headers["elevenlabs-signature"];
    const rawBody = JSON.stringify({
        type: "post_call_transcription",
        event_timestamp: Math.floor(Date.now() / 1000),
        data: { agent_id: "agent_123", conversation_id: "conv_456", status: "done" },
    });
    const sigHeader = signPayload(rawBody, WEBHOOK_SECRET);

    const event = (await client.webhooks.constructEvent(rawBody, sigHeader, WEBHOOK_SECRET)) as {
        type: string;
        data: { conversation_id: string };
    };
    console.log("Verified webhook event:", event.type, event.data.conversation_id);

    // Tampered payloads are rejected:
    try {
        await client.webhooks.constructEvent(`${rawBody} `, sigHeader, WEBHOOK_SECRET);
        throw new Error("Expected the tampered payload to be rejected");
    } catch (error) {
        console.log("Tampered payload rejected:", (error as Error).message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
