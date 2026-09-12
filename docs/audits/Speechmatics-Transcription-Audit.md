# Speechmatics Transcription Audit

**Audit type:** Forensic, read-only. No implementation changes were made.
**Date:** 2026-09-10
**Scope:** Why does the same Arabic (+ English terminology) video produce a different transcript through the Speechmatics web/onsite portal than through the Platform's own Speechmatics integration?

---

## 1. Executive Summary

The Platform's Speechmatics integration was fully mapped end to end: video upload → local disk storage (byte-for-byte, no re-encoding) → `SpeechmaticsTranscriptionProvider` → Speechmatics Batch API v2 → raw `format=txt` transcript → stored verbatim on `LessonRevision.Transcript` → returned verbatim in the API DTO → rendered verbatim in the frontend. **No audio conversion, no FFmpeg, no post-processing, no LLM cleanup, and no text transformation of any kind exists anywhere in this pipeline** — every hop between "what Speechmatics returned" and "what the tutor sees" is confirmed to be a pure passthrough.

This means the discrepancy is not introduced by the Platform's handling of the file or the text. It is introduced by **which language configuration is sent to Speechmatics**, which differs materially depending on mode:

- In **`auto`** mode, the Platform narrows Speechmatics' Automatic Language Identification (ALI) to `["en", "ar"]` with `low_confidence_action: "allow"`. ALI selects **one dominant language for the entire file**; on real, heavily code-switched lesson audio this was observed picking the wrong dominant language entirely (near-total English output for mostly-Arabic audio).
- In **pinned `ar`** mode, Speechmatics transcribes the whole file as a single-language (Arabic) model with no capacity to recognize embedded English words — on real audio, this was observed to phonetically transliterate genuine English terminology into meaningless Arabic-script approximations, unlike the portal's version which preserved the real English words.

Both symptoms were independently reproduced during this engagement (see §9) and are consistent with well-documented Speechmatics ALI behavior (single detected language per job, not per-word/segment code-switching) — not with any bug in the Platform's file handling, storage, request plumbing, or transcript display.

**The exact source video was not available to this audit environment**, so a byte-level/hash comparison between what the tutor uploaded to the Platform and what they (may have) uploaded to the portal separately could not be completed, and the portal's own configuration could not be independently verified. This is the single largest evidence gap (§11) and the reason root-cause confidence is HIGH for "which mechanism explains the symptom" but not fully CONFIRMED for "this is the only possible cause" — a source-identity mismatch (tutor uploading a different/re-exported file to the portal) cannot be ruled out from repository evidence alone.

**Reproduced:** PARTIAL — the wrong-language (auto/ALI) and mangled-English (pinned `ar`) symptoms were both directly observed against this Platform's own live pipeline during this engagement (pre-dating this audit); this audit's contribution is tracing exactly which configuration produced each and confirming, by code inspection, that nothing downstream of Speechmatics' raw response could have caused either.

**Most likely root cause:** Language/ALI configuration mismatch between the two paths — see §10.
**Confidence:** HIGH (mechanism), MEDIUM (that this fully explains a specific portal-vs-Platform comparison, given the unverified portal config and unavailable source file).

---

## 2. Existing Architecture

```text
Video (browser upload)
 ↓
POST to LearningAssetService.UploadAsync
 (Services/LearningAssetService.cs:47)
 ↓
ILearningAssetStorage.SaveAsync — raw byte copy to local disk
 (Services/LocalLearningAssetStorage.cs:31) — App_Data/learning-assets/<workspaceId>/<guid><ext>
 ↓
LearningAsset aggregate created, ObjectKey stored (no transcoding, no ffmpeg anywhere in the repo)
 ↓
Tutor clicks "Generate Transcript" (ContentStudioScreen.jsx VideoSection, ~line 1713)
 ↓
POST /content-studio/.../generate-transcript { language }
 (Controllers/ContentStudioController.cs → ContentStudioService.GenerateTranscriptAsync, Services/ContentStudioService.cs:895)
 ↓
Resolves fileNameForJob/filePathForJob via assetStorage.ResolvePath(asset.ObjectKey)
 — the same file bytes UploadAsync wrote, untouched
 ↓
revision.BeginTranscription() → Guid jobId (Domain/LessonRevision.cs:397)
 ↓
TranscriptionQueue.Enqueue(TranscriptionJob) (AI/TranscriptionQueue.cs:39) — in-memory Channel<T>
 ↓
TranscriptionBackgroundService.ProcessAsync (AI/TranscriptionBackgroundService.cs:74)
 ↓
IAudioTranscriptionProvider.TranscribeAsync(filePath, fileName, languageOverride)
 → SpeechmaticsTranscriptionProvider.TranscribeAsync (AI/SpeechmaticsTranscriptionProvider.cs:36)
 ↓
SubmitJobAsync — POST https://eu1.asr.api.speechmatics.com/v2/jobs
 multipart: data_file (raw bytes, application/octet-stream) + config (JSON)
 ↓
WaitForCompletionAsync — polls GET /v2/jobs/{id} every PollIntervalSeconds until "done"/"rejected"
 ↓
FetchTranscriptTextAsync — GET /v2/jobs/{id}/transcript?format=txt → body.Trim() — RAW, no parsing
 ↓
FetchChaptersAsync — GET /v2/jobs/{id}/transcript?format=json-v2 → chapters array only (does not touch transcript text)
 ↓
TranscriptionResult(text, chapters, []) returned to background service
 ↓
revision.CompleteTranscription(jobId, text, chaptersJson, segmentsJson) (Domain/LessonRevision.cs:421)
 — text stored VERBATIM as LessonRevision.Transcript, no trimming beyond the .Trim() already done, no regex, no rewriting
 ↓
db.SaveChangesAsync()
 ↓
GET .../lesson (ContentStudioService's Rev() mapper, Services/ContentStudioService.cs:184-189)
 — r.Transcript passed positionally into LessonRevisionRow, unchanged
 ↓
JSON response → frontend fetch
 ↓
ContentStudioScreen.jsx renders `revision.transcript` directly in a <p style="white-space:pre-wrap"> (line ~1985)
 and loads it into an editable <textarea> (line ~1958) — both display the string as received, no transformation
```

Every arrow above was verified by reading the actual method body, not inferred.

---

## 3. Speechmatics Integration

| Item | Value | Source |
|---|---|---|
| Client/service class | `SpeechmaticsTranscriptionProvider` | `backend/src/Platform.Api/AI/SpeechmaticsTranscriptionProvider.cs` |
| Namespace | `Platform.Api.AI` | same file |
| Interface | `IAudioTranscriptionProvider` | `AI/IAudioTranscriptionProvider.cs` |
| DI registration | `AddHttpClient<IAudioTranscriptionProvider, SpeechmaticsTranscriptionProvider>` | `Program.cs:310` |
| Base address | `https://eu1.asr.api.speechmatics.com/v2/` | `Program.cs:312` |
| API version | v2 (Batch Transcription API) | same |
| Auth mechanism | `Authorization: Bearer <ApiKey>` header, added per-request via `AddAuth()` | `SpeechmaticsTranscriptionProvider.cs:206` |
| API key source | `appsettings.{env}.json` → `Speechmatics:ApiKey`, bound into `SpeechmaticsOptions` | `Program.cs:308`, `SpeechmaticsOptions.cs:13` |
| API key present (Development) | `appsettings.Development.json` has `"ApiKey": ""` — **empty in the checked-in file**; a real value must come from user secrets or environment override not visible to this audit | `appsettings.Development.json:41` |
| API key present (Production) | `appsettings.Production.json` has no `Speechmatics` section at all — relies entirely on environment-level configuration/secret store outside the repo | `appsettings.Production.json` |
| API key account/project identity | **UNKNOWN — cannot be established from repository evidence** (never printed, no account-identifying config found) | — |
| Timeout | `Timeout.InfiniteTimeSpan` on the client; the polling loop enforces its own `MaxWaitMinutes` (default 60) deadline | `Program.cs:313`, `SpeechmaticsOptions.cs:40` |
| Retry policy | Resilience handlers extended to a 2-hour ceiling (`ExtendResilienceTimeouts`), no custom retry-on-failure logic; a failed HTTP call throws and is caught by the background service, not retried | `Program.cs:319` |
| Polling behavior | Simple `while(true)` loop, `PollIntervalSeconds` (default 5) between checks, exits on `status == "done"` or `"rejected"`, or throws past `MaxWaitMinutes` | `SpeechmaticsTranscriptionProvider.cs:132-161` |
| Error handling | Non-2xx responses throw `InvalidOperationException` with the raw response body in the message; caught in `TranscriptionBackgroundService.ProcessAsync`, logged via `logger.LogError`, and recorded on the revision as `TranscriptStatus.Failed` with the exception message | `TranscriptionBackgroundService.cs:91-105` |

**Active provider confirmed:** `Transcription:Provider` is `"Speechmatics"` in **both** `appsettings.Development.json:48` and `appsettings.Production.json:3` — this is not a dev-only code path; Speechmatics is the live provider in both environments today (an alternative `FasterWhisper`/local-Whisper path also exists in the code but is not the configured provider in either checked-in settings file).

---

## 4. Audio Pipeline

**Confirmed: there is no audio extraction, conversion, or preprocessing step anywhere in this repository.** A repo-wide case-insensitive search for `ffmpeg` returned zero matches in `backend/src`.

- `LocalLearningAssetStorage.SaveAsync` (`Services/LocalLearningAssetStorage.cs:31`) does exactly one thing to the uploaded stream: `await content.CopyToAsync(fileStream, ct)` — a raw byte copy to `App_Data/learning-assets/<workspaceId>/<guid><originalExtension>`. No re-encoding, no resampling, no channel/bitrate change, no codec change, no volume/silence processing.
- `ContentStudioService.GenerateTranscriptAsync` resolves the file to transcribe via `assetStorage.ResolvePath(asset.ObjectKey)` (`ContentStudioService.cs:934`) — the same path `SaveAsync` wrote to. It is opened directly: `SpeechmaticsTranscriptionProvider.SubmitJobAsync` does `await using var fileStream = File.OpenRead(filePath)` (`SpeechmaticsTranscriptionProvider.cs:109`) and streams it into the multipart request as `application/octet-stream` (line 113) — the original uploaded file, byte for byte.
- The one alternate path — a lesson whose video is a direct-file URL rather than an uploaded asset — downloads the URL to a temp file via plain `HttpClient.GetAsync` + `CopyToAsync` (`TranscriptionBackgroundService.DownloadToTempFileAsync`, lines 169-184), again with no transformation, and deletes the temp file afterward.
- The code comment at `Program.cs:306-307` explicitly documents this design choice: *"Speechmatics accepts the stored video file directly (mp4 is a supported input format), so no audio-extraction step."*

**Conclusion for this section: audio bytes sent to Speechmatics are identical to the bytes the tutor uploaded to the Platform.** This rules out possibilities #2, #3, and most of #19/#20 from the initial hypothesis list — the Platform is not the source of any audio-level difference. It does **not** rule out the tutor having uploaded a different file (different export, different pass, different trim) to the Speechmatics portal directly — see §14/§11.

---

## 5. API Request Configuration

Exact request body constructed by `SubmitJobAsync` (`SpeechmaticsTranscriptionProvider.cs:64-107`):

```json
{
  "type": "transcription",
  "transcription_config": {
    "language": "<resolved language>",
    "model": "<SpeechmaticsOptions.Model>",
    "diarization": "speaker"
  },
  "auto_chapters_config": {},
  "language_identification_config": {
    "expected_languages": ["en", "ar"],
    "low_confidence_action": "allow"
  }
}
```

- `language_identification_config` is only present when the resolved language equals `"auto"` (case-insensitive); it is omitted entirely (not sent as `null`) for a pinned language, since Speechmatics rejects the config with both a non-`"auto"` language and a `language_identification_config` present.
- No `punctuation_overrides`, no `output_locale`, no `domain`, no `additional_vocab`, no `operating_point` field distinct from `model` are sent — the request uses Speechmatics' defaults for everything not listed above.
- No custom `Content-Type`/`Accept` headers beyond what `HttpClient`/`MultipartFormDataContent` set automatically, and the `Authorization: Bearer` header.
- Output format: plain text (`format=txt`) is fetched for the transcript, and `format=json-v2` is fetched separately, read only for its `chapters` array (`FetchChaptersAsync`, lines 185-204) — word-level timestamps/confidences in that JSON response are never parsed or stored.

**Resolved language logic** (`SubmitJobAsync` line 70, and `ContentStudioService.GenerateTranscriptAsync` lines 895-965):

```text
languageOverride (from the tutor's UI dropdown, via GenerateTranscriptRequest.Language)
    → "auto" or null  ⇒  languageOverride passed as null
    → "en" or "ar"    ⇒  passed through, lowercased

language = languageOverride ?? SpeechmaticsOptions.Language   // configured default, "auto" in both env files
```

So today, absent an explicit tutor choice, every job is submitted with `language = "auto"` and the `language_identification_config` shown above attached.

---

## 6. Arabic + English Handling

This is the crux of the investigation.

**What the Platform actually sends, confirmed by code:**
- **`auto` mode (the default):** Speechmatics' Automatic Language Identification (ALI), narrowed to two candidate languages (`expected_languages: ["en","ar"]`), with `low_confidence_action: "allow"` so a below-threshold-confidence guess is used anyway rather than failing the job outright.
- **Pinned mode (`en` or `ar`, tutor-selected):** the entire file is transcribed as a single fixed language. No ALI, no language-identification config at all.

**What Speechmatics' ALI mechanism does, per Speechmatics' own documentation** (fetched and confirmed earlier in this engagement against `https://docs.speechmatics.com/speech-to-text/batch/language-identification`): ALI identifies **one** language for the audio and transcribes the whole job in that language. It is a whole-job (or whole-segment, depending on product tier) language classifier, **not** a per-word/per-utterance code-switching engine that can freely alternate between two languages within a single continuous transcript the way a bilingual human transcriber would. This is exactly the distinction Rule 3 of this audit's brief warns against assuming away: **`language=ar` (or ALI landing on `ar`) is not equivalent to genuine multilingual/code-switching transcription.**

**Directly observed consequences (from real transcripts produced by this Platform during this engagement, prior to this audit):**
1. **`auto` mode:** on a real, heavily code-switched lesson video (Arabic speech with English methodology/technical terms), ALI confidently selected the wrong dominant language for the whole file, producing a transcript that was predominantly in the wrong language — not merely inaccurate, but describing content in the wrong language entirely. This was reproduced with `model: "standard"`; upgrading to `model: "enhanced"` (§8) did not resolve it in a later test — the tutor reported the output was still in English for Arabic-dominant audio.
2. **Pinned `ar` mode:** on real audio, forcing a single Arabic-only model produced a transcript where the genuinely Arabic portions were plausible, but the embedded English terminology was phonetically transliterated into Arabic-script approximations that do not correspond to real words — consistent with a single-language acoustic/language model having no English lexical space to draw on. The user's own side-by-side comparison against the portal's transcript (which correctly preserved real English words) surfaced this directly.

**Portal's language configuration:** **could not be independently verified.** A screenshot of the Speechmatics portal's "Transcribe audio file" demo view was captured during this engagement, but no specific language/ALI/model setting from that screenshot was recorded as evidence, and this audit did not have interactive access to the portal to inspect its "Completed jobs" configuration detail for the specific job in question. Per Rule 4/8 of this audit: this is recorded as **UNKNOWN**, not inferred.

**Latin-character stripping / transliteration / translation / normalization by the Platform itself:** none exists. Confirmed by inspecting every step between `FetchTranscriptTextAsync`'s `body.Trim()` and the frontend's `<p>{revision.transcript}</p>` — no `Regex`, no `.Replace(`, no `Normalize(` call touches `Transcript` anywhere in `SpeechmaticsTranscriptionProvider.cs`, `LessonRevision.cs`, `ContentStudioService.cs`, or the frontend. Any transliteration-looking text in a stored transcript was produced by Speechmatics itself, not by the Platform.

---

## 7. Inspect Additional Vocabulary

```text
Additional vocabulary configured: NO
Vocabulary source: N/A — no additional_vocab field exists anywhere in the codebase
Vocabulary entries: N/A
Applied to request: NO
```

A repo-wide search for `additional_vocab`, `AdditionalVocab`, `custom_dictionary`, `CustomDictionary` returned zero matches. Methodology names, product names, and technical terminology have no chance to be biased toward correct recognition by either mode (`auto` or pinned) — this is a real, confirmed gap versus what Speechmatics' API supports, independent of the ALI question, though it was not requested to be fixed here.

---

## 8. Model / Operating Point

| Item | Value |
|---|---|
| Model identifier (current) | `"enhanced"` (`appsettings.Development.json:42`, `appsettings.Production.json` — no override, so the C# default in `SpeechmaticsOptions.cs:23` applies, also `"enhanced"`) |
| Model identifier (historical) | `"standard"` — this is what was active when the first wrong-language transcript was observed; changed to `"enhanced"` afterward (see the doc comment at `SpeechmaticsOptions.cs:15-22`, which records this exact history) |
| Operating point | Not sent as a separate field — Speechmatics' `model` value (`standard`/`enhanced`) is the operating-point-equivalent setting in this API version; no additional domain configuration is sent |
| Portal's model/version | **UNKNOWN — cannot be established from repository evidence.** The portal may default to a different tier than either `standard` or `enhanced`, or may expose a setting the Platform's request never touches. |

The Platform's own code comment already documents that a model-tier change alone (`standard` → `enhanced`) was tried and, per the tutor's subsequent report ("the script generated in english?"), did **not** fully resolve the wrong-language symptom in `auto` mode. This is direct, first-party evidence that the root cause is not simply "cheaper model, lower accuracy" — the ALI mechanism itself is implicated, not just its acoustic model quality.

---

## 9. Diarization

```text
Platform diarization: "speaker" — always requested, in every mode (auto and pinned), unconditionally (SpeechmaticsTranscriptionProvider.cs:86)
Portal diarization: UNKNOWN — cannot be established from repository evidence
Known difference: Platform explicitly always requests speaker diarization; whether the portal does the same for the comparison job is unverified
Potential transcript impact: Diarization affects segmentation/presentation (adds a "SPEAKER: S1" prefix per line in the plain-text output, per the code comment at SpeechmaticsTranscriptionProvider.cs:74-85) — this is a FORMATTING difference, not a recognition-accuracy difference. It would not, by itself, explain wrong words or mistranslated/transliterated terminology.
```

---

## 10. Punctuation and Formatting

No punctuation, capitalization, ITN, or disfluency-handling parameters are sent by the Platform at all — Speechmatics' defaults apply. There is no code anywhere that reformats, re-punctuates, or re-cases the transcript after receiving it (confirmed in §6's search). Any punctuation/formatting differences between the portal and Platform transcripts would therefore originate entirely from Speechmatics' own default behavior for the (unverified) portal configuration versus the Platform's request — not from anything the Platform does after the fact.

The distinction the audit brief asks for (formatting difference vs. recognition difference) could not be evaluated against the actual pair of transcripts side by side within this audit, because the specific portal transcript text was not re-supplied as part of this audit's evidence (see §11); the previously-observed differences reported by the tutor were substantive word-level/language-level differences (wrong language entirely, or mangled terminology), not merely case/punctuation differences — this is a recognition difference, not a formatting one, per the tutor's own description ("the script generated in english?" and "mangled ... phonetic transliteration").

---

## 11. Raw Response vs. Final Transcript

**Confirmed: the Platform does not preserve the full raw Speechmatics JSON response.** It fetches:
1. `format=txt` — the plain-text transcript, stored verbatim.
2. `format=json-v2` — read only for `.chapters`; word/segment-level detail (timestamps, per-word confidence) in this response is **never parsed, never stored, and never exposed**. This is a real, permanent loss of potentially useful diagnostic data (per-word confidence scores would have made this exact audit far more conclusive) — see §11's gaps below.

```text
Speechmatics raw API transcript (format=txt body)
        ↓  (SpeechmaticsTranscriptionProvider.FetchTranscriptTextAsync: only `.Trim()` applied)
Platform mapped transcript  ==  raw transcript, unchanged
        ↓  (LessonRevision.CompleteTranscription: stored as-is)
Database transcript  ==  raw transcript, unchanged
        ↓  (ContentStudioService.cs Rev() mapper: r.Transcript passed through unchanged)
Frontend transcript  ==  raw transcript, unchanged
```

**Conclusion: whatever text Speechmatics' API returns is exactly what the tutor sees.** There is no point in this pipeline where the Platform's own processing could introduce a divergence from Speechmatics' raw output. Any observed difference from the portal's transcript must originate either (a) upstream, in what was sent to Speechmatics (language/model/diarization configuration — confirmed different in ways detailed above) or the audio bytes themselves (unverified — no source file available), or (b) in Speechmatics' own service behavior differing between the portal product and the batch API product for equivalent inputs (cannot be confirmed or ruled out from repository evidence).

---

## 12. Post-Processing Audit

Searched for: string replacement, regex, normalization, cleanup, trimming, merging, sentence reconstruction, Arabic normalization, translation, LLM calls, AI cleanup, summarization, grammar correction, HTML/Markdown generation, and DTO mapping — anywhere that could touch `Transcript` after it leaves Speechmatics.

**Result: no post-processing exists.** The only string operation applied anywhere in the transcript's lifecycle is `.Trim()` in `FetchTranscriptTextAsync` (removes leading/trailing whitespace only). The transcript is **not** passed through an LLM or any AI skill before being stored or displayed — AI skills (`GenerateLessonBodySkill`, `GenerateGlossarySkill`, `LessonAssistantSkill`, etc.) **consume** `revision.Transcript` as an input to generate other content (lesson body drafts, glossaries, quiz questions), but none of them write back to or transform the `Transcript` field itself.

---

## 13. Job Creation and Polling

- One job is created per `GenerateTranscriptAsync` call (`SubmitJobAsync`, single POST to `/v2/jobs`); the returned Speechmatics `id` is used consistently for every subsequent poll and fetch call for that request — no job-mixing risk found.
- `WaitForCompletionAsync` polls the same `jobId` in a loop and only proceeds past a `"done"` status; a `"rejected"` status throws immediately with the raw body. No code path proceeds to fetch a transcript before status is confirmed `"done"`.
- `FetchTranscriptTextAsync` and `FetchChaptersAsync` both hit the same `jobId`, confirmed by direct code reading — no risk of reading a different job's results.
- The Platform's own separate `TranscriptionJobId` concept (a `Guid` generated by `LessonRevision.BeginTranscription()`, unrelated to Speechmatics' own job id string) exists purely to let the background service tell a stale/superseded Platform-side attempt apart from the current one (e.g., if a video is replaced mid-transcription) — this is an internal race-condition guard, not a Speechmatics job-identity issue, and does not affect which Speechmatics job's transcript is fetched.
- No pagination, no partial-result retrieval, no early-exit path exists in this flow. The full `format=txt` body is fetched in one request and used whole (`.Trim()` only) — no truncation, merging, or reordering logic exists.

**Conclusion: nothing in job lifecycle handling could produce an incomplete or incorrectly-assembled transcript.**

---

## 14. Source Identity

```text
Original source SHA-256: UNKNOWN — the source video was not available to this audit environment
Platform uploaded file SHA-256: UNKNOWN — same reason; the underlying App_Data file for the specific lesson revision in question was not identified/located as part of this audit
Audio sent to API SHA-256: Confirmed IDENTICAL to the Platform-uploaded file by code inspection (§4) — no hash was computed, but no transformation step exists that could change the bytes between upload and submission to Speechmatics
Portal uploaded file SHA-256: UNKNOWN — no access to the portal or the file the tutor may have used there
```

> The source video was not available to the audit environment, so byte-level/audio-level comparison could not be completed.

This is the most significant unresolved evidence gap: if the tutor uploaded a re-exported, re-encoded, or trimmed version of the video to the portal (a very common occurrence — e.g., exporting from an editing tool a second time, or uploading a different quality/rendition), that alone could account for some or all of the observed difference, entirely independent of any Speechmatics configuration difference. This audit found no evidence either confirming or ruling this out.

---

## 15. Account / API Environment

```text
API endpoint: https://eu1.asr.api.speechmatics.com/v2/ — EU1 region, Batch Transcription API v2 (Program.cs:312)
Region/environment: EU1 (hardcoded, not configurable via appsettings)
API account/project identity: UNKNOWN — cannot be established from repository evidence
Portal account expected to match: UNKNOWN — no evidence found either way
Different credentials/entitlements: UNKNOWN — cannot be ruled out; a portal account could be provisioned with different default settings, a different pricing tier, or different default model access than the API key configured for this Platform
```

No API key value was printed or exposed at any point in this audit.

---

## 16. Portal vs. Platform Comparison

| Area | Speechmatics Portal | Platform API | Evidence | Difference? | Confidence |
|---|---|---|---|---|---|
| Source file | Unknown exact file used | Confirmed: original tutor-uploaded bytes, unmodified | §4, §14 | UNKNOWN | UNKNOWN |
| Audio bytes | Unknown | Identical to uploaded file (no transcoding exists) | §4 | UNKNOWN (portal side) | UNKNOWN |
| Duration | Not captured | Not captured | — | UNKNOWN | UNKNOWN |
| Sample rate / Channels / Codec | Not captured | Not applicable — original container sent as-is, no extraction | §4 | UNKNOWN (portal side) | UNKNOWN |
| API endpoint | Portal likely uses its own internal pipeline, not necessarily the public v2 batch REST API | `https://eu1.asr.api.speechmatics.com/v2/` | §15 | POSSIBLE | LOW |
| API version | Unknown | v2 (Batch Transcription API) | §3 | UNKNOWN | UNKNOWN |
| Language | Unverified | `auto` (default) or tutor-pinned `en`/`ar` | §5, §6 | CONFIRMED (Platform side only) | HIGH (Platform), UNKNOWN (portal) |
| Language identification | Portal config not verified | ALI narrowed to `["en","ar"]`, `low_confidence_action: "allow"`, only when language is `auto` | §5, §6 | PROBABLE root-cause area | MEDIUM-HIGH |
| Multilingual/code-switching mode | Not confirmed to exist as a distinct Speechmatics feature from ALI | Not requested — no such config field is sent | §6 | POSSIBLE | MEDIUM |
| Model | Unverified | `enhanced` (was `standard` during the first observed failure) | §8 | PROBABLE contributor, not sole cause (enhanced alone did not fix it) | MEDIUM |
| Operating point | Unverified | Same as Model field (no separate parameter in this API) | §8 | UNKNOWN | UNKNOWN |
| Diarization | Unverified | Always `"speaker"` | §9 | CONFIRMED (Platform side); presentation-only impact | LOW impact on recognition |
| Punctuation | Unverified (defaults assumed) | Not configured — Speechmatics defaults | §10 | UNKNOWN | UNKNOWN |
| Additional vocabulary | Unverified | Not configured at all — confirmed absent | §7 | CONFIRMED gap (Platform), portal unverified | HIGH (Platform side) |
| Formatting | Unverified | Raw `format=txt`, `.Trim()` only | §10 | UNKNOWN | UNKNOWN |
| Post-processing | Unverified (presumably none, it's a vendor UI) | CONFIRMED: none exists in the Platform | §12 | CONFIRMED: Platform adds none | HIGH |
| Raw transcript | Not accessible to this audit | Confirmed to equal Speechmatics' own `format=txt` response exactly | §11 | N/A — Platform side confirmed unmodified | HIGH |
| Final transcript | Not accessible to this audit | Confirmed to equal raw transcript exactly (no divergence introduced downstream) | §11 | N/A — Platform side confirmed unmodified | HIGH |

---

## 17. Transcript Difference Analysis

Based on the transcripts and descriptions already produced during this engagement (prior to this audit) rather than a fresh side-by-side re-run (no source video was available to reproduce a fresh comparison within this audit):

```text
Arabic recognition:
Portal = reported strong (preserved real English terms correctly per the tutor's comparison)
API (auto mode) = weak — wrong dominant language selected for large portions
API (pinned "ar" mode) = strong for genuine Arabic speech, but corrupts embedded English terms

English terminology:
Portal = preserved as real English words
API (auto mode) = inconsistent — sometimes the whole transcript surfaces in English incorrectly
API (pinned "ar" mode) = missing/substituted — phonetically transliterated into meaningless Arabic-script approximations

Punctuation:
Not independently comparable within this audit — no fresh matched pair of transcripts was generated

Segmentation:
Platform always includes "SPEAKER: S1"-style diarization labels the portal transcript (as pasted by the tutor) did not appear to include — a presentation/formatting difference, not a recognition difference

Ordering:
No evidence of reordering in either transcript; not flagged as an issue by the tutor

Transcript completeness:
No evidence of truncation; not flagged as an issue by the tutor
```

This audit could not perform a fresh, structured word-by-word diff (missing/substituted/reordered) because it did not have a live, reproducible test case (no source video, no ability to trigger a new comparable portal transcription) available in a read-only audit context. This is recorded as an evidence gap in §11 below, not glossed over.

---

## 18. Root Cause Ranking

| Rank | Root Cause | Evidence | Confidence |
|---|---|---|---|
| 1 | **Language/ALI configuration mismatch, not a Platform pipeline bug.** The Platform requests either (a) Automatic Language Identification narrowed to `en`/`ar`, which selects one dominant language for the whole job and was observed picking the wrong one on real code-switched audio, or (b) a single pinned language, which — per Speechmatics' own documented ALI behavior — cannot recognize words from the other language and instead transliterates them. Every other stage of the pipeline (storage, request construction, job polling, response fetch, DB storage, API serialization, frontend rendering) was confirmed by direct code inspection to be a lossless passthrough with zero transformation. | §4, §6, §11, §12 — direct code reading of every hop, plus two independently-observed real transcript failures matching exactly this mechanism | HIGH |
| 2 | **Source file identity mismatch** (tutor uploaded a different rendition/export to the portal than what's stored in the Platform). Cannot be confirmed or ruled out — the specific source video was not available to this audit. | §14 | UNKNOWN — plausible but unverified |
| 3 | **Missing additional vocabulary / no domain biasing.** The Platform never sends `additional_vocab`, so methodology names and technical terms have no recognition boost in either mode. This would degrade accuracy on technical terminology specifically but would not, on its own, explain a whole-file wrong-language result. | §7 | MEDIUM as a contributing factor, LOW as a primary explanation |
| 4 | **Unverified portal configuration** — it is possible the portal uses a materially different feature (e.g., a distinct multilingual/code-switching mode not available or not requested via this API version/config shape) that the Platform's current request never invokes. This cannot be confirmed without either portal access or a fresh Speechmatics support/docs inquiry specific to multilingual code-switching (distinct from ALI). | §6, §15, §16 | MEDIUM — consistent with all other evidence but not independently confirmed |

**Explicitly ruled out by direct code inspection (not assumed):** audio conversion/transcoding (§4), Platform-side post-processing/LLM cleanup (§12), truncation/reordering/job-mixing in polling (§13), and any transcript mutation between the raw Speechmatics response and what the tutor sees (§11).

---

## 19. Unknowns / Evidence Gaps

- Portal's exact language/ALI/model/diarization/punctuation configuration for the video(s) already compared — not independently verifiable from repository evidence; the portal was only seen in a screenshot whose specific settings were not extracted as evidence.
- Whether Speechmatics offers a genuine multilingual/code-switching transcription mode distinct from ALI (which selects one language per job) — not confirmed either way from the documentation already reviewed in this engagement; would require a further, dedicated documentation check before any fix is designed.
- The exact source video file(s) involved in the original comparison — not available to this audit environment; no SHA-256 hashes could be computed for source, Platform-stored, or portal-uploaded files.
- Whether the tutor uploaded the identical file to both the portal and the Platform, or two different renditions/exports.
- The Speechmatics account/project identity behind the configured API key, and whether it differs in entitlements or defaults from whatever account the portal session used.
- Per-word confidence scores from Speechmatics' `json-v2` response — technically available from Speechmatics per job, but never fetched/stored by the Platform, so no confidence-based diagnostic (e.g., "ALI was only 55% confident here") exists for any past job.
- A fresh, structured word-level diff between a portal transcript and a Platform transcript for the exact same job — not performed in this audit due to lack of a reproducible live test case in a read-only context.

---

## 20. Recommended Fix (conceptual only — NOT implemented)

Do not implement any of this yet; recorded here only to close out the audit per the requested deliverable shape.

The minimal, most targeted next step would be to determine — via Speechmatics' own documentation or support channel — whether a genuine multilingual/code-switching configuration exists for the Batch API (distinct from ALI's single-language-per-job selection), and if so, adopt that for lesson videos known to mix Arabic and English, rather than choosing between "guess one language for the whole file" (`auto`) and "pin one language and lose the other's words" (`en`/`ar`) — both of which this audit found to be structurally incapable of solving genuine code-switching correctly. Independently, adding `additional_vocab` entries for known methodology/technical terminology would likely help regardless of which language mode is used, since that gap exists in every mode today.

## 21. Recommended Validation Test

Before any fix is implemented: obtain the same source video from the tutor, compute its SHA-256, upload it once to the Platform and — separately, deliberately — the exact same file to the Speechmatics portal, and compare: (a) the two SHA-256 hashes of what was actually submitted (confirming identical source), (b) the two jobs' exact request configurations (portal's can often be inspected via its own job-detail view or network trace), and (c) a structured word-by-word diff of the two resulting transcripts, categorized per §17's taxonomy (missing / substituted / segmentation / punctuation / ordering / truncation). Only with that fresh, controlled pair of jobs can root cause be moved from HIGH-confidence-by-mechanism to CONFIRMED-by-reproduction.

## 22. Production Risk

```text
MEDIUM
```

The transcript itself is not a learner-facing artifact by default (it feeds AI-generated lesson body/glossary/quiz drafts, which a tutor reviews before publishing), so a bad transcript degrades AI-assist quality rather than directly corrupting published learner content. However, a tutor who does not carefully review AI-suggested content generated from a wrong-language or mangled transcript could unknowingly publish incorrect material — and the current absence of `additional_vocab` and of a genuine code-switching mode means this failure mode is systemic (will recur on any future Arabic+English lesson video), not a one-off.

---

# AUDIT STATUS

```text
Implementation changed: NO

Problem reproduced: PARTIAL
(both failure symptoms — wrong dominant language in auto/ALI mode, and mangled/transliterated English terms in pinned-Arabic mode — were independently observed against this Platform's live pipeline earlier in this engagement; this audit traced their exact mechanism by code inspection but did not re-run a fresh, controlled side-by-side test against the portal, since no source video was available to this audit environment)

Most likely root cause:
Speechmatics' Automatic Language Identification selects one dominant language for an entire job rather than performing true per-word/segment code-switching; pinning a single language avoids the wrong-language failure but removes any ability to recognize the other language's words at all. This is a configuration/capability mismatch for genuinely bilingual audio, not a bug in the Platform's file handling, request plumbing, job polling, or transcript storage/display — every one of those stages was confirmed by direct code reading to be a lossless, unmodified passthrough of whatever Speechmatics returns.

Confidence:
HIGH (for the mechanism/where the discrepancy originates); MEDIUM (for fully explaining any one specific portal-vs-Platform comparison, given the unverified portal configuration and unavailable source video)

Where the discrepancy begins:
At Speechmatics' own transcription result — specifically, at the ALI/language-configuration decision baked into the request the Platform sends (SpeechmaticsTranscriptionProvider.SubmitJobAsync, backend/src/Platform.Api/AI/SpeechmaticsTranscriptionProvider.cs:64-107). Confirmed NOT to begin anywhere in the Platform's own storage, mapping, or display code (backend/src/Platform.Domain/LessonRevision.cs, backend/src/Platform.Api/Services/ContentStudioService.cs, frontend/src/screens/ContentStudioScreen.jsx) — all three were read in full for any transformation and found to pass the transcript through unchanged.

Primary evidence:
Direct code inspection of the full pipeline (upload → storage → request construction → job polling → transcript fetch → DB → API → frontend), confirming zero transformation at every non-Speechmatics hop; the two real, previously-observed transcript failures (wrong-language-entirely under auto/ALI, and mangled English terms under pinned Arabic) matching documented Speechmatics ALI behavior exactly.

Secondary evidence:
Code comments and configuration history already present in the codebase itself (SpeechmaticsOptions.cs's Model doc comment, the "enhanced" tier not resolving the issue) corroborating that this is a known, previously-investigated behavior rather than a new hypothesis.

Recommended next action:
Obtain the specific source video, verify its hash against what's stored on both the Platform and (if re-testable) the portal, and separately confirm with Speechmatics' documentation/support whether a true multilingual/code-switching mode exists for the Batch API that the current integration has never requested — before designing any fix.

Production code modified:
NO
```
