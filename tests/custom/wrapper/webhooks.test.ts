import crypto from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import { ElevenLabsError } from "../../../src/errors";
import { WebhooksClient } from "../../../src/wrapper/webhooks";

const SECRET = "webhook_secret";

function signedHeader(body: string, secret: string, timestampSecs: number): string {
    const message = `${timestampSecs}.${body}`;
    const signature = crypto.createHmac("sha256", secret).update(message).digest("hex");
    return `t=${timestampSecs},v0=${signature}`;
}

describe("WebhooksClient.constructEvent", () => {
    const client = new WebhooksClient({ apiKey: "test-key" });
    const payload = { eventType: "test_event", data: { id: "123" } };
    const body = JSON.stringify(payload);

    it("returns the parsed payload for a valid signature", async () => {
        const now = Math.floor(Date.now() / 1000);
        const event = await client.constructEvent(body, signedHeader(body, SECRET, now), SECRET);
        expect(event).toEqual(payload);
    });

    it("rejects a missing signature header", async () => {
        await expect(client.constructEvent(body, "", SECRET)).rejects.toBeInstanceOf(ElevenLabsError);
        await expect(client.constructEvent(body, "", SECRET)).rejects.toThrow(/Missing signature header/);
    });

    it("rejects a missing secret", async () => {
        const now = Math.floor(Date.now() / 1000);
        const header = signedHeader(body, SECRET, now);
        await expect(client.constructEvent(body, header, "")).rejects.toThrow(/Webhook secret not configured/);
    });

    it("rejects a header without the v0 scheme", async () => {
        await expect(client.constructEvent(body, "t=123,v1=abc", SECRET)).rejects.toThrow(
            /No signature hash found with expected scheme v0/,
        );
    });

    it("rejects a timestamp older than the tolerance window", async () => {
        const stale = Math.floor(Date.now() / 1000) - 31 * 60;
        const header = signedHeader(body, SECRET, stale);
        await expect(client.constructEvent(body, header, SECRET)).rejects.toThrow(
            /Timestamp outside the tolerance zone/,
        );
    });

    it("rejects a signature computed with the wrong secret", async () => {
        const now = Math.floor(Date.now() / 1000);
        const header = signedHeader(body, "wrong_secret", now);
        await expect(client.constructEvent(body, header, SECRET)).rejects.toThrow(/Signature hash does not match/);
    });
});
