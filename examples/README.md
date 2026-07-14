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
npx ts-node -P examples/tsconfig.json examples/speech-engine-server.ts
```

## Type-checking

The examples are type-checked in CI:

```bash
yarn tsc -p examples
```
