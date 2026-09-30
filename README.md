# Platform

## Local development prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 22](https://nodejs.org/)
- Docker (Aspire's local orchestration needs it for Postgres and related containers)
- **ffmpeg** — required for `TranscriptionInputMode.Audio` (the default mode for AI-generated
  lesson transcripts): the backend extracts the audio track locally before sending it to the
  configured transcription provider. Install it with:

  ```
  brew install ffmpeg
  ```

  The backend resolves it from `PATH` in Development by default (`Transcription:FfmpegPath`,
  default `"ffmpeg"` — see `backend/src/Platform.Api/AI/TranscriptionOptions.cs`). If it isn't
  installed, the app still starts, but logs a clear error at startup
  (`AudioExtractor.ProbeAsync`) and Audio-mode transcription against a non-Gemini provider will
  fail; a Gemini-provider request falls back to `VideoLowRes` instead (no local extraction
  needed), so transcription still works, just at a higher AI-credit cost.

  Production doesn't need this installed locally or on the server — the GitHub Actions build
  downloads a pinned, checksum-verified static ffmpeg build and publishes it alongside the app
  (see `.github/workflows/deploy.yml`), since Azure App Service (Linux)'s .NET runtime container
  has no system ffmpeg of its own.

## Running the backend

```
dotnet run --project backend/src/Platform.AppHost
```

This starts the Aspire AppHost, which orchestrates the API and its dependencies (Postgres, etc.)
locally. Run only one instance at a time — it shares one Postgres volume, and a second instance
run alongside it will corrupt data.

## Running the frontend

```
cd frontend
npm install
npm run dev
```
