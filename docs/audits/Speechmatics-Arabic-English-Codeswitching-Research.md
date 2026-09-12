# Speechmatics Arabic + English Code-Switching Research

**Type:** Documentation research only. No implementation changes were made.
**Date:** 2026-09-11
**Builds on:** `docs/audits/Speechmatics-Transcription-Audit.md` (read-only pipeline audit, previously completed)

---

## 1. Executive Conclusion

**Yes — Speechmatics documents genuine, dedicated support for Arabic + English code-switching within a single job, and it is a different feature from Automatic Language Identification (ALI).** Two distinct, currently-documented mechanisms exist:

1. **Bilingual language pack `ar_en`** — a `language` value usable directly with the existing **Standard** or **Enhanced** models (the same models the Platform already uses). Speechmatics' own Languages documentation states these packs let "speakers who switch between the languages in that pack" be transcribed correctly within one file. This requires **no model change, no new API version, and no new region** — it is a configuration-only change to a request the Platform already knows how to build.
2. **Melia 1** — a distinct, purpose-built multilingual model (`model: "melia-1"`, `language: "multi"`), launched by Speechmatics in 2026 specifically for code-switched audio. Speechmatics' own published benchmark names Arabic-English explicitly and claims Melia 1 achieves "less than half the mixed error rate of the next best model" on Arabic/English code-switching. It is Batch-only and restricted to the EU1/US1 regions — both compatible with the Platform's existing EU1 endpoint.

Both are one-pass, Speechmatics-native solutions — **no LLM-based correction pass is needed or recommended**, satisfying the architectural preference stated in this task.

Neither mechanism is currently used anywhere in the Platform. The previous audit's finding stands and is now sharpened: the Platform's `auto` mode uses ALI, which Speechmatics' own documentation confirms identifies **one predominant language for the entire file**, not per-utterance code-switching — ALI was simply never the right tool for this requirement, and the correct tool(s) already exist. This is a **configuration gap, not a Speechmatics capability gap.**

**Which of the two is the better starting candidate is not fully resolved by documentation alone** — see §10 and §13 — and this report recommends a specific controlled test (§9) before either is adopted, rather than committing to one from documentation claims alone.

---

## 2. Existing Platform Situation (from the prior audit)

Recapped, not re-investigated — treated as established evidence per this task's instructions:

- **Provider:** Speechmatics, Batch Transcription API, base address `https://eu1.asr.api.speechmatics.com/v2/` (EU1 region, v2).
- **Audio pipeline:** confirmed lossless — no FFmpeg, no transcoding; the exact uploaded file bytes are sent to Speechmatics.
- **Current `auto` mode:** `language: "auto"` with `language_identification_config: { expected_languages: ["en","ar"], low_confidence_action: "allow" }` — this is Automatic Language Identification (ALI), confirmed by the prior audit and re-confirmed against current documentation in §5 below to select one dominant language for the whole file.
- **Current pinned mode:** `language: "ar"` (or `"en"`) with no `language_identification_config` — a single fixed-language model, no ability to recognize the other language's words at all.
- **Model:** `"enhanced"` (changed from `"standard"` after a real wrong-language failure; the change alone did not resolve the underlying issue).
- **No `additional_vocab`** is configured anywhere.
- **Diarization** (`"speaker"`) is always requested, in both modes.
- **No post-processing, no LLM cleanup, no transcript rewriting anywhere in the Platform** — confirmed end-to-end; whatever Speechmatics returns is exactly what is stored and displayed.
- **Known unknowns carried forward:** the exact Speechmatics portal configuration used for past comparisons was never verified; no source video was available to hash-compare Platform vs. portal uploads.

---

## 3. Speechmatics Capabilities (from current official documentation)

Verified directly against `docs.speechmatics.com` (fetched during this research) and Speechmatics' own published articles:

| Capability | Source | Key fact |
|---|---|---|
| Standard/Enhanced models | `docs.speechmatics.com/speech-to-text/models` | Support "a selected language or language pack" — bilingual/multi-language packs are a first-class, documented feature of these two existing models, not a separate product. |
| Bilingual/multi-language packs | `docs.speechmatics.com/speech-to-text/languages` | Explicitly lists **Arabic & English (`ar_en`)** as one of several supported packs (also `en_ms`, `cmn_en`, `cmn_en_ms_ta`, `en_ta`, `tl`, and a Spanish/English pack that uses a different mechanism — see §6 note). Packs "enable handling speakers who switch between the languages in that pack" within one file. |
| Automatic Language Identification (ALI) | `docs.speechmatics.com/speech-to-text/batch/language-identification` | Config: `language: "auto"`, optional `expected_languages`, `low_confidence_action`. Documentation states the system "identifies and applies a single predominant language to the entire file" — no mention of mid-file switching. Requires ≥60 seconds of speech in the identified language to reliably identify it. 9 languages are unsupported for ALI (not Arabic/English — both are supported for ALI itself, just not for code-switching within it). |
| Melia 1 | `docs.speechmatics.com/speech-to-text/models`, `speechmatics.com/company/articles-and-news/introducing-melia-multilingual-speech-to-text-model`, `speechmatics.com/company/articles-and-news/melia-code-switching-arabic-mandarin-tamil` | A distinct multilingual model, `model: "melia-1"`, requires `language: "multi"` (explicitly does **not** support `"auto"`, the bilingual/multi-language pack codes, or translation). Supports 55+ languages, performs per-word language labeling, handles code-switching "across all 55+ languages" as a single continuous transcript. Speechmatics' own benchmark article names **Arabic-English** as one of the language pairs it specifically measured and states it leads there. Batch-only today; real-time is announced as forthcoming but not yet available. Available in EU1 and US1 regions (confirmed via search of Speechmatics' own region/pricing documentation — not independently re-verified against a primary docs page listing region-by-model availability in table form). |
| Custom dictionary / `additional_vocab` | `docs.speechmatics.com/speech-to-text/features/custom-dictionary` | Up to 1000 words/phrases per job, each up to 6 words, optional `sounds_like` pronunciation hints. Documentation does **not** state whether this is compatible with bilingual packs or with Melia 1 specifically — see §7 and §13 (open question). |
| `operating_point` | `docs.speechmatics.com/speech-to-text/models` | Legacy/deprecated name that maps onto `model` with identical accepted values — not a separate concept from `model` in the current API. |

---

## 4. Fixed Arabic vs. ALI vs. Multilingual — Comparison

| Capability | What it does | Arabic + English in same recording? | Suitable for our requirement? |
|---|---|---|---|
| `language="ar"` (fixed/pinned) | Loads a single-language acoustic + language model for Arabic only. Every sound is mapped to the nearest Arabic-language token — there is no English lexical space to draw on. | **No.** Embedded English is forced into Arabic phonetic approximations (exactly the symptom observed in production). | Not suitable alone. |
| ALI / `language="auto"` | Detects **one** predominant language for the *entire file*, then transcribes the whole file in that language, from Speechmatics' documented behavior. Narrowing via `expected_languages` only limits which languages it's allowed to guess between — it does not enable switching between them mid-file. | **No** — by design, it picks one language for the whole job, not per-utterance. | Not suitable — this is the documented reason for the "whole file classified as English" failure mode. |
| Bilingual/multi-language pack (e.g. `language="ar_en"`, model `enhanced`/`standard`) | Loads a model trained to recognize **both** listed languages and switch between them as speakers do, within one continuous file. Documented explicitly as handling "speakers who switch between the languages in that pack." | **Yes**, for the specific pack Arabic+English is listed as one of the supported combinations. | **Yes — directly matches the stated requirement**, using models the Platform already targets. |
| Melia 1 (`model="melia-1"`, `language="multi"`) | A purpose-built multilingual model that auto-detects and switches between any of 55+ supported languages within one file, with per-word language labeling, without requiring the languages to be pre-selected. | **Yes** — Arabic-English is explicitly named in Speechmatics' own code-switching benchmark as a measured, leading use case for this model. | **Yes — the most direct, purpose-built match**, at the cost of being a newer, more narrowly available (Batch-only, EU1/US1-only) feature. |

---

## 5. Arabic + English Code-Switching — the Specific Answer

**Per-utterance/per-segment behavior:** Neither the bilingual-pack documentation nor the Melia 1 documentation retrieved during this research spells out the exact internal granularity (per-token vs. per-word vs. per-segment) at which language switching is detected. What is documented, directly and consistently across multiple official sources, is the **outcome**: both mechanisms produce a single continuous transcript in which words are recognized in whichever of the configured/supported languages they were actually spoken in — this is the behavior the business requirement asks for, regardless of the exact internal mechanism.

**Does `ar` + `en` coexist inside the same audio, in a single job, today, per Speechmatics' current documentation?** Yes, via either of the two mechanisms in §3/§4. This directly answers the central question in the affirmative — this is **not** something that requires a two-pass or LLM-assisted architecture.

**Requires ALI?** No. Both the bilingual pack and Melia 1 are configured independently of `language: "auto"` and its `language_identification_config` block — Melia 1's documentation explicitly states it does **not** accept `"auto"` as a language value at all, and a bilingual pack is simply a different literal value for the `language` field, not a form of ALI.

**Is it different from ALI?** Confirmed, explicitly, by Melia 1's own documentation excluding `"auto"` as a valid value — these are presented as mutually exclusive configuration choices, not layered features.

---

## 6. Model / API Version Requirements

| Item | Bilingual pack (`ar_en`) | Melia 1 |
|---|---|---|
| `model` value | `"enhanced"` or `"standard"` (both already used/supported by the Platform's existing options) | `"melia-1"` (new value, not currently sent by the Platform) |
| `language` value | `"ar_en"` (a single literal pack code, not `"ar"` + a separate flag — confirmed by the Languages doc listing it as its own pack code) | `"multi"` (mandatory; `"auto"` is explicitly rejected for this model) |
| API version | v2 Batch Transcription API — the same version and endpoint shape the Platform already calls; no version bump indicated by any documentation found | Same — no separate API version or endpoint path was found; it is presented as a `model` value within the same `transcription_config` schema |
| Region | Not restricted beyond normal model/region support (EU1 already used by the Platform) | **EU1 and US1 only** (not EU2/US2/AU1, per Speechmatics' region/pricing documentation) — the Platform's existing EU1 endpoint is compatible |
| Availability | Batch and Realtime | **Batch only today**; Realtime "on the way" but not yet available |
| Breaking change risk | Low — same request shape, different literal value | Low for the request shape itself, but `"multi"` is documented as incompatible with `language: "auto"`, translation, and the pack codes — a job must be explicitly built for Melia, not toggled on top of the existing `auto`/pinned logic without change |

**One documentation gap:** neither the models page nor the languages page explicitly states a minimum audio-duration requirement for the bilingual pack the way ALI's 60-second minimum is explicitly stated. This is recorded as an open question (§13), not assumed to be absent.

---

## 7. Additional Vocabulary

**Which case applies:** for the bilingual pack, this is **Case 1** — English is a genuinely, natively recognized language within the `ar_en` pack (not bolted on), so `additional_vocab` entries for specific methodology names/technical terms would plausibly still help disambiguate proper nouns and jargon the general language model wasn't trained heavily on, exactly as intended by the feature's stated purpose ("a specific word is not recognised... not in the vocabulary for that language, for example a company or person's name").

For Melia 1, the same reasoning would apply in principle (English is natively one of its 55+ recognized languages), **but this was not documentation-confirmed** — no page found during this research states whether `additional_vocab`/custom dictionary is compatible with `model: "melia-1"` at all.

```text
Additional vocabulary configured today: NO (confirmed by the prior audit)
Vocabulary source: N/A
Would it help under ar_en: PROBABLE YES (Case 1 reasoning; not directly confirmed in docs for this specific pack)
Would it help under melia-1: UNKNOWN — not addressed by any documentation source found
Can it "fix" a pinned Arabic-only model's inability to recognize English (Case 2): NO — a single-language model has no English phonetic/lexical space at all; vocabulary entries bias which words are chosen among what the model can already say, they do not add a new language's sounds to a model that never learned them. This directly rules out "add English methodology terms as additional_vocab under language=ar" as a fix for the pinned-mode failure.
```

---

## 8. Portal vs. API

**Still could not be independently verified** — no interactive access to the Speechmatics portal was available to this research, and no official documentation page found describes exactly which model/language configuration the portal's UI defaults to for a mixed-language upload.

What can now be said with more confidence than the prior audit: given that `ar_en` and `melia-1` are both current, documented, generally-available product features (not obscure/undocumented ones), it is **plausible** that the portal's transcript quality advantage observed earlier in this engagement came from the portal either defaulting to, or offering the tutor a manual choice of, one of these two mechanisms — rather than from some undocumented or internal-only portal behavior. This remains an inference, not a confirmed fact.

```text
Portal transcription mode for multilingual content: UNKNOWN — could not be verified from documentation
Portal auto-selecting a multilingual model: UNKNOWN
Portal code-switching option exposed in UI: UNKNOWN (plausible, given the feature exists product-wide, but not confirmed)
Portal vs API expected to be identical for equivalent configuration: UNKNOWN — no documentation found asserting or denying this
```

---

## 9. Controlled Test

The smallest experiment that can conclusively settle which configuration to adopt, without touching the Platform:

| Test | Content | Configuration(s) to try | What it isolates |
|---|---|---|---|
| **A — Arabic only** | Short, clean Arabic-only sample | `language="ar"`, `model="enhanced"` (current pinned config) | Baseline: confirms pure-Arabic recognition quality is unaffected by any change under consideration |
| **B — English only** | Short, clean English-only sample | `language="en"`, `model="enhanced"` | Baseline: confirms pure-English recognition quality |
| **C — Arabic + one embedded English term** | e.g. "Arabic sentence ... Bloom's Taxonomy ... Arabic sentence" | Run the **same clip** three ways: (1) `language="auto"` + current `language_identification_config` [current Platform behavior], (2) `language="ar_en"`, `model="enhanced"` [candidate 1], (3) `model="melia-1"`, `language="multi"` [candidate 2] | Directly compares all three against the exact failure mode already observed in production |
| **D — repeated code-switching** | Arabic / English methodology term / Arabic / English technical term / Arabic | Same three configurations as Test C | Confirms behavior holds under *repeated* switching, not just a single embedded phrase |
| **E — the actual production video** | The real lesson video that first demonstrated the problem | Same three configurations as Test C, submitted as three **separate** jobs against the identical file (verify via SHA-256 that all three jobs received byte-identical input) | Ground-truth validation against the real failure case, with a real portal transcript (if obtainable for the same exact file) as a fourth reference point |

**Isolated experiment, without modifying the Platform:** each of these is a standalone call to `POST https://eu1.asr.api.speechmatics.com/v2/jobs` using the existing API key, made independently (via `curl`, Postman, or a throwaway script outside the Platform's codebase) — not through any Platform code path. This keeps the experiment fully outside the "do not modify the implementation" boundary while still using the real production endpoint and credentials.

---

## 10. Determine Whether a Two-Pass Strategy Is Necessary

**Not necessary.** §5 and §9 establish that Speechmatics documents at least one, plausibly two, one-pass mechanisms that directly address the stated requirement. Per this task's explicit instruction, a two-pass (Speechmatics-then-LLM) architecture is **not** recommended, evaluated in detail, or designed here, because the primary premise for needing it — "Speechmatics itself cannot do this" — was not established. If the controlled test in §9 unexpectedly shows both `ar_en` and `melia-1` still failing to preserve English terminology on the real production video, that would be the trigger to revisit a two-pass design — not before.

---

## 11. Recommended Configuration (conceptual — NOT implemented)

Two viable, documented, one-pass candidates — **do not implement either without first running §9's controlled test**:

**Candidate 1 — Bilingual pack (lower-risk, mature feature, minimal request-shape change):**
```json
{
  "type": "transcription",
  "transcription_config": {
    "language": "ar_en",
    "model": "enhanced",
    "diarization": "speaker"
  },
  "auto_chapters_config": {}
}
```
No `language_identification_config` block — this pack is a fixed (not auto-detected) language selection, so ALI's block is neither needed nor applicable.

**Candidate 2 — Melia 1 (newer, purpose-built, specifically benchmarked for this exact language pair):**
```json
{
  "type": "transcription",
  "transcription_config": {
    "language": "multi",
    "model": "melia-1",
    "diarization": "speaker"
  },
  "auto_chapters_config": {}
}
```
Diarization compatibility with `melia-1` was not explicitly confirmed or denied in any documentation source found during this research — flagged as an open question (§13), included here as the same setting the Platform already sends today, not as a confirmed-compatible value.

Both candidates eliminate `language_identification_config` (ALI) entirely — neither uses or needs it.

---

## 12. Alternatives (only if §9's test shows the direct solution is insufficient)

Not designed in detail per this task's instructions, since the direct solution was established as documented and available. If, after running §9, both candidates still fail on the real production video specifically, the next investigative step would be a support request to Speechmatics (§15) before considering any LLM-assisted secondary pass — not the other way around.

---

## 13. Risks / Limitations

- **Melia 1 availability constraints:** Batch-only (no realtime yet), EU1/US1 region-only. The Platform's current EU1 endpoint is compatible, but this is a narrower deployment footprint than the Standard/Enhanced models the Platform can otherwise use anywhere Speechmatics operates.
- **`additional_vocab` compatibility with either candidate is unconfirmed** — if it turns out to be incompatible with `melia-1` specifically, that would remove one lever for fixing remaining technical-terminology misses under that model.
- **Diarization compatibility with `melia-1` is unconfirmed** — the Platform always requests `diarization: "speaker"`; if this is silently ignored or rejected under Melia, that would be a real (if presentation-only, per the prior audit's own finding) regression to catch during testing, not after adoption.
- **Minimum audio duration for the bilingual pack is not documented** the way ALI's 60-second minimum is — an unusually short lesson clip's behavior under `ar_en` is unverified.
- **Pricing:** Melia 1 has its own published starting price ($0.129/hour with a 10-hour/month free allowance per one search result) — potentially different from the Enhanced-model bilingual-pack cost; not verified against the Platform's actual Speechmatics contract/plan, which is outside what any documentation search can determine.
- **Neither candidate has been validated against the Platform's own real failing video** — everything in §5/§6 is documentation-sourced, not yet reproduced against the specific audio that originally exposed the problem. This is precisely why §9 specifies Test E as mandatory before any adoption decision.

---

## 14. Open Questions

1. Does `additional_vocab` work with `language: "ar_en"`? With `model: "melia-1"`?
2. Does `diarization: "speaker"` work correctly (or at all) under `model: "melia-1"`?
3. Is there a minimum audio-duration requirement for the `ar_en` bilingual pack, analogous to ALI's 60-second minimum?
4. What is the actual per-word/per-segment mechanism Melia 1 and the bilingual packs use internally to decide where a language switch occurred — is there any observable per-word confidence/language-tag output the Platform could capture for diagnostics? (The `json-v2` format is already fetched today for chapters and could plausibly carry per-word language tags for Melia 1, per its "per-word language labeling" description — this was not independently confirmed against a sample response.)
5. Which of the two candidates is actually better for a *predominantly-Arabic-with-occasional-English* speech pattern specifically (as opposed to the more evenly-mixed pairs like Mandarin-English that Speechmatics' benchmark article foregrounds) — Speechmatics' own benchmark claims about Melia 1's lead are not broken out by which language is dominant in the recording.
6. Does the Platform's Speechmatics plan/contract already include access to `melia-1`, or does it require a separate enablement/upgrade? (Not determinable from public documentation — this is an account-specific question.)
7. What configuration does the Speechmatics portal actually use by default (or offer) for a mixed Arabic/English upload? (§8 — unresolved.)

---

## 15. Draft Support Question (not sent)

> Subject: Batch API configuration for predominantly-Arabic educational recordings with embedded English terminology
>
> We run batch transcription (EU1 region, API v2) for educational lesson videos that are predominantly Arabic speech containing intermittent English methodology names and technical terminology (e.g., "Bloom's Taxonomy" spoken within an otherwise-Arabic sentence). We need the Arabic speech to remain Arabic and the English terms to be recognized as English within the same job — not translated, and not phonetically transliterated into Arabic script.
>
> We've identified two candidate configurations from your documentation and would like to confirm before adopting either:
>
> 1. The `ar_en` bilingual language pack (`transcription_config: { "language": "ar_en", "model": "enhanced" }`) — does this specifically support a *predominantly one language, with occasional switches into the other* speech pattern, or is it tuned primarily for more evenly-balanced code-switching?
> 2. The Melia 1 model (`model: "melia-1"`, `language: "multi"`) — is this generally available on our account/plan today, and does it require a separate enablement step?
>
> Additional questions:
> - Does `additional_vocab` (custom dictionary) work with either the `ar_en` pack or `melia-1`? Can dictionary entries be in a different language than the recording's dominant language?
> - Does `diarization: "speaker"` work correctly under `model: "melia-1"`?
> - Is there a minimum audio-duration requirement for the `ar_en` pack, similar to the 60-second minimum documented for Automatic Language Identification?
> - Is `model: "melia-1"` confirmed available in the EU1 region specifically (not just "EU" generally)?
> - Are there pricing differences between the Enhanced-model `ar_en` pack and `melia-1` that we should plan for?

---

## 16. Final Recommendation

**Run the controlled test in §9 against both candidates (`ar_en` bilingual pack on Enhanced, and `melia-1`/`multi`) using the real production video that originally exposed this problem, before implementing either in the Platform.** Documentation establishes with HIGH confidence that Speechmatics supports genuine one-pass Arabic+English code-switching and that ALI was simply the wrong feature for this requirement — but documentation alone cannot resolve which of the two candidates performs better on this Platform's specific speech pattern (predominantly Arabic with occasional English terms, as opposed to more evenly-mixed speech), nor resolve the open questions in §13/§14 around vocabulary and diarization compatibility. Given `ar_en` requires no model/region change and is the lower-risk, longer-established feature, it is the more conservative first candidate to test — but Melia 1's specific, named benchmark advantage on Arabic-English code-switching makes it a strong second candidate that should not be skipped based on documentation risk-aversion alone.

---

# SPEECHMATICS CODE-SWITCHING INVESTIGATION
==========================================

```text
Platform implementation changed: NO

True Arabic + English code-switching supported:
YES — via two documented mechanisms, neither currently used by the Platform.

Current `ar` configuration:
Fixed single-language model. Cannot recognize English words at all — produces phonetic Arabic-script transliteration of English terms. Confirmed unsuitable for the requirement.

Current `auto` configuration:
Automatic Language Identification (ALI), narrowed to en/ar. Selects ONE predominant language for the entire file per Speechmatics' own documentation — not designed for, and not capable of, per-utterance code-switching. Confirmed to be the wrong feature for this requirement, not merely a misconfiguration of the right one.

Recommended Speechmatics capability:
Candidate 1: Bilingual language pack, language="ar_en", model="enhanced" (or "standard") — mature feature, no model/region change from what the Platform already uses.
Candidate 2: Melia 1 multilingual model, model="melia-1", language="multi" — newer, purpose-built for code-switching, explicitly benchmarked by Speechmatics on Arabic-English specifically.

Required API version:
Same v2 Batch Transcription API the Platform already calls — no version change indicated by any documentation found.

Required model:
"enhanced"/"standard" (Candidate 1) or "melia-1" (Candidate 2).

Required configuration:
language="ar_en" (Candidate 1) or language="multi" (Candidate 2, mandatory — "auto" is explicitly rejected for this model). No language_identification_config needed for either.

Additional vocabulary required:
OPTIONAL — plausibly helpful for both candidates (English is a natively recognized language in each, so vocabulary can bias/disambiguate rather than trying to teach a language the model doesn't have), but compatibility with either candidate specifically was not confirmed in documentation.

Portal configuration verified:
NO — still unverified; documentation cannot establish what the Speechmatics portal defaults to or offers for this scenario.

Controlled test required:
YES — see §9. Neither candidate has been validated yet against this Platform's actual production video.

Primary evidence:
Direct fetches of docs.speechmatics.com/speech-to-text/models, /speech-to-text/languages, and /speech-to-text/batch/language-identification, plus Speechmatics' own published Melia 1 introduction and Arabic/Mandarin/Tamil code-switching benchmark articles.

Confidence:
HIGH — that genuine one-pass code-switching support exists and ALI was the wrong tool.
MEDIUM — on which of the two candidates is the better fit for this Platform's specific (predominantly-Arabic) speech pattern, and on several compatibility details (vocabulary, diarization) left open by documentation gaps.

Next Platform change:
DO NOT IMPLEMENT YET — run the §9 controlled test first; a separate implementation task should follow only once one candidate is validated against the real production video.
```
