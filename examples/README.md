# Examples

Runnable examples for the ElevenLabs JS SDK.

## Setup

From the repository root:

```bash
yarn install
export ELEVENLABS_API_KEY="your-api-key"
```

## Running an example

The examples import `@elevenlabs/elevenlabs-js`, which is mapped to the local
SDK source via `examples/tsconfig.json`, so no publish step is needed:

```bash
npx ts-node -P examples/tsconfig.json examples/text-to-speech.ts
npx ts-node -P examples/tsconfig.json examples/text-to-speech-streaming.ts
npx ts-node -P examples/tsconfig.json examples/speech-to-text.ts
npx ts-node -P examples/tsconfig.json examples/webhooks.ts
npx ts-node -P examples/tsconfig.json examples/speech-engine-server.ts
```

Environment variables the examples understand:

- `ELEVENLABS_API_KEY` — your API key (required against the real API)
- `ELEVENLABS_BASE_URL` — point the SDK at a different API base URL (used by the smoke runner)
- `ELEVENLABS_SKIP_PLAYBACK` — write audio to `output.mp3` instead of playing it with ffplay
- `AUDIO_FILE` — path to your own audio file for `speech-to-text.ts`

## CI checks

The examples are type-checked in CI:

```bash
yarn tsc -p examples
```

They are also executed in CI against a local mock of the ElevenLabs API
(no API key needed), via the smoke runner:

```bash
node examples/smoke/run.mjs
```

`speech-engine-server.ts` is excluded from the smoke run because it starts a
long-running WebSocket server; it is covered by type-checking and the
speech-engine test suites.
