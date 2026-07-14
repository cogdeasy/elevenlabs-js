import { describe, expect, it } from "@jest/globals";
import { isNode, toAsyncIterable } from "../../../src/wrapper/utils";

describe("isNode", () => {
    it("returns true when running under Node.js", () => {
        expect(isNode()).toBe(true);
    });
});

describe("toAsyncIterable", () => {
    function makeStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
        return new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(chunk);
                }
                controller.close();
            },
        });
    }

    it("yields every chunk in order", async () => {
        const chunks = [new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5, 6])];
        const received: Uint8Array[] = [];
        for await (const chunk of toAsyncIterable(makeStream(chunks))) {
            received.push(chunk);
        }
        expect(received).toEqual(chunks);
    });

    it("releases the reader lock when done", async () => {
        const stream = makeStream([new Uint8Array([1])]);
        for await (const _chunk of toAsyncIterable(stream)) {
            // drain
        }
        // If the lock was released, acquiring a new reader must not throw.
        expect(() => stream.getReader()).not.toThrow();
    });

    it("releases the reader lock when iteration stops early", async () => {
        const stream = makeStream([new Uint8Array([1]), new Uint8Array([2])]);
        for await (const _chunk of toAsyncIterable(stream)) {
            break;
        }
        expect(() => stream.getReader()).not.toThrow();
    });
});
