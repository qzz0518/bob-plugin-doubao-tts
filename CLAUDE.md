# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A [Bob](https://bobtranslate.com/) TTS plugin that uses Volcengine Doubao (豆包) speech synthesis model V3 HTTP streaming API. Bob is a macOS translation/TTS app; plugins run in a custom JavaScript runtime (not Node.js, not browser).

## Build & Package

```bash
# Package the plugin (run from project root)
cd src && zip -r ../doubao-tts.bobplugin . -x ".*"

# Get SHA256 for appcast.json
shasum -a 256 doubao-tts.bobplugin
```

There is no build system, linter, or test framework. The plugin is a zip of the `src/` directory renamed to `.bobplugin`.

## Architecture

- **`src/info.json`** — Plugin metadata, version, and user-configurable options (App ID, Access Key, model, voice, audio format, speech rate, timeout). This is the Bob plugin manifest.
- **`src/main.js`** — Core TTS logic. Exports `supportLanguages()`, `tts()`, `pluginTimeoutInterval()`, and `pluginValidate()` as the Bob plugin interface. Sends streaming POST to `https://openspeech.bytedance.com/api/v3/tts/unidirectional`, accumulates NDJSON audio chunks, and returns base64-encoded audio.
- **`src/lang.js`** — Supported language list and lookup.
- **`appcast.json`** — Version manifest for Bob's auto-update system. Versions array is reverse-chronological (newest first).

## Bob Plugin Runtime Constraints

- **No ES6 modules** — use `require()` / `exports` (CommonJS-style)
- **No Node.js or browser APIs** — only JS built-ins and Bob globals: `$http`, `$data`, `$option`, `$log`
- `$http.streamRequest()` requires Bob >= 1.8.0; uses `streamHandler` for chunked data and `handler` for completion
- `$data.fromBase64()` / `$data.fromData()` / `appendData()` / `toBase64()` for binary operations
- `$option.<identifier>` reads values from user plugin settings defined in `info.json`

## Release Process

1. Edit source in `src/`, bump version in `src/info.json`
2. Re-package: `cd src && zip -r ../doubao-tts.bobplugin . -x ".*"`
3. Get SHA256: `shasum -a 256 doubao-tts.bobplugin`
4. Prepend new version entry to `appcast.json` (with sha256, timestamp via `date +%s000`)
5. Commit, push, then create GitHub Release: `gh release create v1.x.x doubao-tts.bobplugin --title "..." --notes "..."`

## API Details

- Doubao V3 HTTP endpoint returns NDJSON (one JSON per line)
- Audio chunks: `code=0` with base64 `data` field; completion: `code=20000000`
- Auth via headers: `X-Api-App-Id`, `X-Api-Access-Key`, `X-Api-Resource-Id`
- Resource ID must match voice type: `seed-tts-2.0` for 2.0 voices, `seed-tts-1.0` for 1.0 voices
