# PDF & Image Lesson Content Extraction — Design Proposal

> Version: 1.8
>
> Status: Draft — Proposed, pending sign-off (§9, §10.1's inline viewer, §11, and §12 are
> designed but not built; §4.1's `VisibleToLearners`, §9's `Reading` delivery mode, and
> §10.3's `RequireQuizToComplete` domain field have since been implemented in code —
> confirmed directly, see §11.0; the Claude-only multimodal extension and the
> `NotSupportedException` fix from §4.7/§11.0 are also implemented)
>
> Domain: AI / Learning Asset / Learning Delivery (cross-cutting)
>
> Author: Drafted for tutor sign-off, 2026-08-15; revised 2026-08-16 after a completeness
> review (closed five gaps: technical limits, failure modes, privacy, usage metering, and
> confirming the review-UX mechanics against the actual frontend code); revised again
> 2026-08-16 after tutor discussion surfaced that attaching a file and making it
> downloadable to students were wrongly treated as the same action (§2, §4.1, §5); revised
> again 2026-08-16 to document that quiz-question generation from a PDF is an emergent
> capability of the existing Standalone Quiz flow, not something this feature needs to
> build (§8, EXT-008); revised again 2026-08-16 to add a `Reading` delivery mode — a
> video-less, PDF-based lesson cannot publish under either existing delivery mode today
> (§9, EXT-009) — and to specify the tutor-facing copy for §8's save-before-quiz sequencing
> (§8); revised again 2026-08-16 after a question about student-side rendering surfaced
> that a Reading lesson would auto-complete the instant it's opened under today's logic —
> fixed with a tutor-configurable completion toggle, not a fixed rule; homework-gating
> confirmed out of scope, since no submission-tracking system exists to gate on (§10,
> EXT-010, EXT-011); revised again 2026-08-16 to resolve EXT-011 — now that Assignment and
> Submission are both formalized at the Aggregate Design level (Assignment Aggregate
> Design; Assessment and Submission Aggregate Design v1.1), homework submission is
> designed as a deliberately narrow v1 bridge rather than left out of scope, closing the
> Reading-lesson completion cycle end to end; this pass also found and specifies the fix
> for a live bug — `RequireQuizToComplete` exists in code but is never actually consulted
> (§11); revised again 2026-08-16, during actual Phase 1 implementation, to document a
> fourth failure mode §4.7 didn't originally call out by name — a configured AI provider
> that doesn't support multimodal input throws `NotSupportedException`, not the
> `InvalidOperationException` every other failure mode here is caught by, and the dev
> environment's own `Ollama` provider hits this path today, not hypothetically (§4.7);
> revised again 2026-08-16 to design full local-dev parity for Extract — Ollama gains the
> attachment overload too, for both images (direct) and PDFs (rendered to page images
> locally first, a new capability this codebase doesn't have yet), so development doesn't
> require any Claude API calls at all; Claude remains the only production-quality path,
> with local vision-model results expected to be visibly weaker (§12)
>
> Related Documents:
>
> - Learning Asset Aggregate Design
> - Lesson Revision Aggregate Design
> - AI Authoring Assistant Architecture
> - `AI /AISkillArchitecture.md`
> - `AI /AIModelProviderArchitecture.md`
> - AI Interactive Video Lesson Generator
> - CapabilityTierReference
> - Technical Debt Backlog
> - Assignment Aggregate Design
> - Assessment and Submission Aggregate Design
> - Assignment Business Analysis
> - Learning Activity Assignment Business Analysis

---

## 1. Request and scope

The ask: let a tutor get a PDF's or image's content and data into a lesson, not just have it sit as a downloadable attachment.

Two things were decided already, not re-litigated here:

- **Both** — a PDF/image keeps working exactly as it does today (attach it as a Resource), **and** a new AI-powered "extract into the lesson" action is added alongside it. Neither replaces the other.
- Where extraction runs was "not sure — investigate first." Section 3 is that investigation's answer.

One refinement was added after the first draft, in discussion: "attach it" and "make it downloadable to students" turned out to already be the same action in this codebase, unconditionally — and a tutor uploading source material purely to feed extraction (their own notes, a scanned page they don't have redistribution rights to hand out) does not necessarily want that file to become a student-facing download just because it was attached. §2 confirms this is real, not hypothetical; §4.1 and §5 cover the fix.

This document is the artifact requested to close that decision: domain model impact, the new AI Skill, and the review UX (does extraction overwrite fields, or offer something to approve), so implementation can start from an agreed design instead of a guess.

---

## 2. Current state, as built (not as designed)

Two of the source documents above — Learning Asset Aggregate Design and Lesson Revision Aggregate Design — describe a richer target architecture than what exists in `Platform.Domain` today. This section is the actual code, checked directly, because the gap between the two changes what this feature can build on.

**`LearningAsset` is much simpler than its aggregate design doc.** The design doc's §6 lists eleven asset categories (Video, Audio, PDF, Slide Deck, Image, SCORM Package, …) and a `Uploaded → Processing → Ready → Archived` state machine driven by an "Asset Processing Job" entity (OCR, transcript generation, thumbnailing, …). The implemented `LearningAssetCategory` enum has exactly two values — `Video` and `Resource` — and `LearningAssetStatus` has three states, not four: the enum comment says so directly — *"No asynchronous processing pipeline exists yet (no real transcoding or AI enrichment), so an asset moves straight from Uploaded to Ready."* `LearningAsset.Upload(...)` sets `Status = LearningAssetStatus.Ready` unconditionally. There is no Asset Processing Job entity, no AI Metadata value object, and no per-asset processing status anywhere in code. A PDF or image uploaded today is a `LearningAssetCategory.Resource` — the same bucket as a worksheet or slide deck — distinguished only by its stored `ContentType` and `OriginalFileName`.

**The one AI-async pattern that does exist lives on `LessonRevision`, not `LearningAsset`.** Video transcription is the only asynchronous AI job actually implemented. Its status (`TranscriptStatus`: `None → Processing → Ready/Failed`) is a field on `LessonRevision`, written by `TranscriptionBackgroundService` after draining `TranscriptionQueue` (an in-process, unbounded `System.Threading.Channels.Channel<T>` with a single background worker). The queue's own doc comment is explicit about its limitation: *"A job in flight is lost if the process restarts — an accepted limitation for a prototype... worth revisiting before this is a production feature."* No Technical Debt Backlog entry tracks this (confirmed — nothing in `Technical Debt Backlog.md` mentions transcription or the queue at all).

**The other AI pattern that exists — and the more relevant precedent — is the synchronous "AI-suggest" family.** `ContentStudioController` exposes `draft/ai-suggest-body`, `-what-youll-learn`, `-title`, `-learning-objectives`, `-glossary`, `-homework`: one POST per field, each backed by a small Skill class (e.g. `GenerateLessonBodySkill`) calling `AiOrchestrator.RunTextAsync`/`RunAsync<T>`, each returning immediately with a plain suggestion. Every one of these endpoints is documented the same way in code: *"Nothing is saved — the tutor still hits Save themselves."* This is the as-built expression of AIA-002/003/005 (AI Authoring Assistant Architecture §11) — no queue, no status field, no persistence until the tutor acts.

**An entitlement gate already exists for an AI capability on `LessonRevision`, and it is the closest precedent for gating this feature.** `GenerateTranscriptAsync` checks `entitlements.HasEntitlementAsync(workspaceId, EntitlementResolutionService.AiKey(CapabilityDomain.Learning), AiAssistanceLevel.Assist.ToString(), ct)` before enqueuing a job, failing with *"AI transcription needs the Professional plan or an AI-enabled Learning pack."* This is a real, working per-task gate on the `Learning` capability domain at the `Assist` level — CapabilityTierReference §2's profile → AI-level mapping (`Foundation→Manual`, `Professional→Assist`, `AiPlus→CoPilot`) already resolves it. Nothing about extraction needs a new gating mechanism invented; it needs the same call.

**`IAiModelProvider`/`ClaudeModelProvider` are text-only today, and additive to extend.** `IAiModelProvider.CompleteAsync(string systemPrompt, string userPrompt, ...)` takes only two plain strings. `ClaudeModelProvider`'s internal `ClaudeMessage.Content` is typed `string`, not the Claude Messages API's content-block array — so today's implementation cannot send an image or a PDF to the model at all. This matches what AIModelProviderArchitecture §58 ("Multimodal Models") already anticipates as a Model Requirement (`Vision = Required`) the Model Router should consider — the architecture expects this need; the code hasn't caught up yet.

**Attaching a file and making it downloadable to students are the same action today, with no way to separate them.** `LessonResource`'s own doc comment states this directly: it is *"a supplementary file a tutor attaches to a Lesson Revision — slides, a worksheet, a handout — shown to learners as a download alongside the lesson."* Its fields are `Id`, `LessonRevisionId`, `LearningAssetId`, `Position`, `CreatedAt` — no visibility or draft flag of any kind. Confirmed in the frontend too: `ContentStudioScreen.jsx`'s resource-upload handler calls `api.uploadLearningAsset(...)` immediately followed by `api.addLessonResource(...)` in the same function — there is no existing path to upload a file for this lesson without it becoming a student-visible download. A tutor uploading a PDF purely so AI can read it would, under the naive version of this design, involuntarily publish that file to students. §4.1 below is the fix.

**No AI Skill records usage or consumes credits today — a pre-existing gap, not one this feature introduces (see §4.9).** AISkillArchitecture §26/27 describes "AI Credits"/"AI Requests" as a usage dimension every Skill should declare, and Usage & Metering as its authoritative home. Nothing in `Platform.Api/AI` or `ContentStudioService` writes a usage event anywhere — confirmed by search, no matches. `GenerateTranscriptAsync` and every `ai-suggest-*` call are gated by entitlement (§4.4) but not metered. Extraction inherits this exact gap unchanged; closing it is out of scope here and would be a platform-wide fix, not something specific to PDF/image extraction.

---

## 3. Where extraction should run

Two real candidates exist in this codebase's own patterns, and they point to different answers depending on the size of what's asked:

**Not a new microservice, and not the Python transcription service.** `services/transcription` exists because transcription needs Whisper/Speechmatics — a fundamentally different model family from the text/vision LLM this Platform already calls for every other authoring task. PDF and image content extraction is squarely a multimodal LLM call: "read this document/image and return structured lesson content" is the same shape of request as every existing `ai-suggest-*` Skill, just with a document or image attached instead of plain text. Standing up a second service for this would duplicate `AiOrchestrator`/`IAiModelProvider`/the Skill abstraction for no architectural reason — Claude's Messages API accepts image and PDF content blocks natively.

**Recommendation: extend `ClaudeModelProvider`, not the abstraction's shape.** Add multimodal support at the provider layer — `IAiModelProvider` gains a way to pass along one or more attachments (raw bytes + declared media type) next to the existing prompts, and `ClaudeModelProvider` is the only implementation that has to honor it (per Provider Isolation, AIModelProviderArchitecture §18 — a provider that can't support a capability should fail clearly, not silently degrade; `OpenAiModelProvider`/`GeminiModelProvider`/`OllamaModelProvider` can each decide independently whether and when to implement it). This is additive to the interface, not a breaking change to the four existing providers' text-only call sites.

**Sync, not queued — deliberately breaking from the transcription precedent, not following it.** A single document or image, sent once to Claude, is one model call with the same latency shape as every existing `ai-suggest-*` request (a few seconds), not the minutes-long external-provider job transcription is. Modeling this as a `TranscriptionQueue`-style background job would add a status field, a queue, a worker, and the restart-durability risk described in §2 — for a workload that doesn't need any of it at this size. §6 revisits this if a multi-hundred-page PDF turns out to change that assumption.

---

## 4. Domain and API design

### 4.1 `LearningAssetCategory` unchanged; `LessonResource` gains a visibility flag

**Category**: a PDF or image continues to upload as `LearningAssetCategory.Resource`, exactly as today. The aggregate design doc's aspirational `Pdf`/`Image` categories are not introduced in this pass: nothing in the current code branches on category beyond `Video` vs. everything-else, so widening the enum now would be speculative — it earns no behavior. Eligibility for the new "Extract" action is determined at read time from the asset's stored `ContentType`/`OriginalFileName` extension (`application/pdf`, `image/png`, `image/jpeg`, etc.), the same way the existing transcription flow already gates on file extension (`SupportedTranscriptionExtensions`) without a dedicated category. This is a real divergence from Learning Asset Aggregate Design §6's taxonomy, worth a one-line cross-reference note there.

**Visibility — the actual fix for §2's finding.** `LessonResource` gains one new field: `VisibleToLearners` (bool). Every existing resource migrates in as `true` — the current, unconditional "attached means downloadable" behavior is preserved exactly for anything already attached. Two new pieces follow from that field:

- `LessonRevision.AddResource(learningAssetId, visibleToLearners)` — the method gains a parameter (defaulted to `true` at existing call sites so nothing else in the codebase has to change its call shape).
- A new mutator, `LessonRevision.SetResourceVisibility(resourceId, visibleToLearners)`, so a tutor can flip a resource's visibility after the fact in either direction — hide something they realize shouldn't be a download, or later decide to share something that started as extraction-only source material. Mirrors `RemoveResource`'s existing shape (look up by `resourceId`, mutate, no cross-aggregate work needed since it's a same-revision change).
- `ResourcesScreen.jsx`/`LearnerLessonScreen.jsx` (student-facing) filter to `VisibleToLearners == true`. `ContentStudioScreen.jsx` (tutor-facing) shows all attached resources regardless of visibility, with a badge/toggle so the tutor manages everything attached to the lesson from one list rather than two.

This was considered against decoupling attachment entirely (letting extraction operate on an unattached `LearningAsset`, since Learning Asset Aggregate Design's INV-002 already allows an asset to exist unreferenced) and rejected for v1: that path leaves uploaded-for-extraction files with no home in the lesson editor unless separately attached, whereas the flag keeps one list, one migration, and exactly the behavior a tutor already expects from every other toggle in this UI.

### 4.2 New AI Skill

One Skill, `ExtractLessonContentFromResourceSkill`, following the existing `GenerateLessonBodySkill`-style class shape (a system prompt plus one method calling `AiOrchestrator`). `SkillId`: `learning.extract_resource_content`, per AISkillArchitecture §15's dot-namespaced convention (sibling to `learning.generate_lesson`, `media.transcribe_video`). A single skill dispatching internally on MIME type (PDF vs. image) is preferred over two separate skills (`learning.extract_pdf_content` / `learning.extract_image_content`) because the output contract and review UX are identical either way — the only difference is which Claude content-block type wraps the bytes. This can split later without breaking callers, since Skill identity is independent of implementation (AISkillArchitecture §18, "Skill Versioning").

**Output contract**: structured JSON via `AiOrchestrator.RunAsync<T>` (not `RunTextAsync`), matching AISkillArchitecture §21/§508's preference for structured output "whenever application logic consumes the result" (SKILL-008). Confirmed against the actual DTOs in `Models/ContentModels.cs` (not assumed): each existing suggest endpoint has its own single-field request/response pair —

```csharp
public record AiSuggestBodyResponse(string Body);
public record AiSuggestWhatYoullLearnResponse(string WhatYoullLearn);
public record AiSuggestTitleResponse(string Title);
public record AiSuggestLearningObjectivesResponse(string LearningObjectives);
public record AiSuggestGlossaryResponse(string Glossary);
public record AiSuggestHomeworkResponse(string Homework);
```

Extraction's response is the natural merge of these into one record, each field nullable since a source document may not support all of them:

```csharp
public record ExtractResourceContentResponse(
    string? Title, string? Body, string? WhatYoullLearn, string? LearningObjectives, string? Glossary);
```

A field the source document doesn't clearly support is left null, not fabricated — the same non-invention discipline `GenerateLessonBodySkill`'s system prompt already states explicitly ("Do not invent facts... the original material does not support"). Homework is left out of v1's contract (see §7, requirement EXT-001) — the six existing DTOs above are five distinct fields plus Homework, and Homework is the one most tied to assessment authoring rather than reading comprehension of an uploaded document, so it's the one field deferred.

### 4.3 API endpoint

A new synchronous endpoint on `ContentStudioController`, alongside the existing `draft/ai-suggest-*` family — for example `POST content-studio/.../resources/{resourceId}/extract`. Cross-aggregate for the same reason `AddResourceAsync` and `GenerateTranscriptAsync` already are (it needs to load the `LearningAsset`'s stored file), so it cannot go through the single-aggregate `MutateLessonAsync` delegate either. Behavior:

1. Resolve caller/workspace, `requireAuthor: true` (same authority model as every other Content Studio mutation).
2. Entitlement check — reuse `GenerateTranscriptAsync`'s exact gate: `EntitlementResolutionService.AiKey(CapabilityDomain.Learning)` at `AiAssistanceLevel.Assist`. This gate is now confirmed twice over, not once — `SuggestBodyAsync` and every other `ai-suggest-*` method use the identical call, failing with *"AI content assistance needs the Professional plan or an AI-enabled Learning pack."* Extraction reuses that same check and, for consistency, the same message shape.
3. Load the target `LearningAsset` by `resourceId`, scoped to the workspace; reject if its `ContentType`/extension isn't a supported PDF/image type, or if it exceeds the size limits in §4.6 below.
4. Read the file via `ILearningAssetStorage` (already used identically by `GenerateTranscriptAsync`'s `assetStorage.ResolvePath(...)`), call the new Skill.
5. Return the suggestion bundle. **Nothing is persisted** — same contract as every `ai-suggest-*` endpoint today.

Failure handling follows the exact pattern `SuggestBodyAsync` already uses — `catch (InvalidOperationException ex) { return Fail(ProvisioningError.Conflict, $"AI content generation failed: {ex.Message}"); }` — with one addition specific to extraction: a pre-flight size/page check (step 3) that fails fast with `ProvisioningError.Invalid` and a message naming the concrete limit, *before* an oversized file is ever sent to Claude and burns a slow request only to be rejected server-side. See §4.7.

### 4.4 Entitlement gate — recommend reusing the transcript gate, not opening a new question

The investigation into "does this need AI-credit/tier gating" resolved cleanly: it does, and there's already a working answer in this codebase. `GenerateTranscriptAsync` gates on `CapabilityDomain.Learning` at `Assist`. Content extraction is the same capability domain (Learning) at the same tier of AI involvement (drafting suggested content a tutor reviews, not autonomous publishing) — CapabilityTierReference §4's task table already lists "Lesson/Quiz/Question/Worksheet Generation" at `Assist` on Professional, `Co-Pilot` on AI+, which is the same bucket this feature belongs in. No new tier concept, pack, or pricing decision is needed to ship this; it rides the existing Learning domain gate.

### 4.5 Async is not required for v1, revisit only if evidence says otherwise

`TranscriptionQueue`'s doc comment already names the tradeoff this decision is about: async buys resilience to long-running jobs at the cost of a queue, a status field, and (currently) the undocumented restart-loss risk. A single PDF or image sent to Claude's Messages API in one request doesn't have the "minutes-long external job" shape that justified the queue for transcription. If a very large multi-page PDF later proves slow or hits a context-length limit, the fix is more likely to be page-range chunking than a queue — worth a follow-up design note if it happens, not a reason to build the queue now.

### 4.6 Claude API technical limits — the validation this feature actually needs

The Platform's general upload cap (500MB, enforced today only for `IFormFile` size, MIME-checked only for Video category) is far looser than what the Messages API will accept for a document or image content block. Current published limits (Anthropic docs, checked 2026-08-16):

| | Limit |
|---|---|
| PDF — request payload | 32 MB, including everything else in the request |
| PDF — pages | 100 pages (under a 1M-token context window; higher with the 1M-context beta) |
| Image — per file | 10 MB, base64-encoded |
| Image — dimensions | 8000×8000 px (2000×2000 px if the request carries more than 20 images — not applicable here, one image per extraction) |
| Image — formats | JPEG, PNG, GIF, WebP |

A tutor can upload a Resource today that is valid by the Platform's own rule (well under 500MB) and still be far outside what Claude will accept. Step 3 of §4.3's pipeline must check the stored `FileSizeBytes` (and, for PDFs, ideally page count, though that requires opening the file — a byte-size check alone is a reasonable v1 proxy) against these limits *before* calling the Skill, and fail with a specific message ("This PDF is larger than the 32 MB extraction can currently handle — you can still attach it as a downloadable resource.") rather than a generic AI failure. This also means the "attach it as a Resource" path from §1 is not just a fallback for tutors who don't want extraction — it's the only option for a subset of files extraction can never support at this size, which is worth stating plainly rather than leaving implicit.

### 4.7 Failure modes

Beyond the size/page pre-check in §4.6, four outcomes need an explicit response. Three follow `SuggestBodyAsync`'s existing `InvalidOperationException` → `Fail(ProvisioningError.Conflict, ...)` shape; the fourth needs a different `catch`, found only once real implementation reached it (added 2026-08-16, during Phase 1 build-out):

- **Model call fails** (rate limit, provider error, timeout) — same `catch` pattern as every other Skill call today; no special handling beyond what already exists.
- **Model returns no usable content** (a blank scan, an unreadable handwritten page, a document in a language the model can't extract from) — the Skill should return a response with every field null rather than throw, and the endpoint should distinguish this from a hard failure: a 200 with an empty bundle plus a short reason string, so the UI can say "couldn't find lesson content in this file" instead of a red error banner implying something broke.
- **Resource no longer exists or isn't a PDF/image** — `ProvisioningError.NotFound`/`Invalid`, same as `AddResourceAsync`'s existing checks for a missing `LearningAsset`.
- **The configured AI provider doesn't support multimodal input at all.** §3's Provider Isolation call was deliberate: `IAiModelProvider`'s new attachment-carrying overload has a default implementation that throws `NotSupportedException`, specifically so a provider that hasn't opted in fails clearly rather than silently degrading. That is a different exception type from the `InvalidOperationException` every other failure mode here catches, which means it needs its own `catch (NotSupportedException ex)` clause — omitting it doesn't just miss a message, it lets the exception surface as a raw unhandled 500, worse than every other failure mode on this list. This is not a hypothetical: the dev environment's `Ai:Provider` is `Ollama`, not Claude (`appsettings.Development.json`), and `OllamaModelProvider` doesn't override the attachment overload — so an Extract call in dev hits this path today, not just in some future misconfiguration. The clean fix is the same shape as the others: catch it, return `Fail(ProvisioningError.Conflict, "AI content extraction needs a provider that supports document/image input — the current AI provider does not.")` or equivalent, rather than a generic message that implies a transient failure a retry might fix.

None of these are new problems this feature invents; they're the same four shapes every existing AI endpoint already handles (three of them, at least) applied to one more Skill — the fourth is genuinely new to this Skill specifically, since it's the first one that can be asked of a provider that structurally cannot do what's being asked, rather than one that tried and failed.

### 4.8 Privacy and data residency

AIModelProviderArchitecture §39–40 names `Workspace Region`/`Provider Region`/`Data Residency Requirement` and a `PrivacyRequirement` (`NoExternalTraining`, `RestrictedDataProcessing`, `RegionalProcessing`) as things the Model Router should consider, with "a model that violates the Workspace policy must not be selected." None of this is wired up anywhere in code today — no Workspace carries a residency or privacy setting, and every AI call (including every existing `ai-suggest-*` endpoint) already sends tutor-authored text straight to Claude's API with no such check. Extraction sends a tutor's uploaded document bytes to the same place. This is a larger surface than a text prompt in the sense that a document may contain more identifying material than a typed paragraph, but it is not a new *category* of exposure — the Platform already has no residency/privacy enforcement layer for any AI call. Flagged here so it isn't invisible, not because extraction needs to solve it alone; if this is a blocker, it blocks every existing AI feature equally and is a platform-level fix.

### 4.9 Usage and credit metering

Covered in full in §2 (confirmed by direct search of `Platform.Api/AI` and `ContentStudioService` — no usage-event write exists anywhere in the codebase today). Referenced here only so the numbering in §7's EXT-007 points somewhere concrete: this is a platform-wide gap extraction inherits, not one it needs to close.

---

## 5. Frontend UX

**Attach, with one new default.** `ContentStudioScreen`'s Resources section still accepts any file type with no `accept` restriction and no client-side validation. What changes: the upload call now sends `visibleToLearners: false` by default for newly-uploaded PDFs/images (§4.1), with an explicit checkbox — "Also share this as a downloadable resource for students" — the tutor can check at upload time to get today's exact behavior back. Files uploaded through this flow still appear in the Resources list either way, just tagged (a small "not shared with students" label) when the box is left unchecked, and the tutor can flip that later via `SetResourceVisibility` without re-uploading. Non-PDF/image resources (existing use, e.g. slide decks meant as handouts) keep defaulting to visible, since that's the established expectation for that flow.

**The existing "review" mechanism, confirmed precisely, not assumed.** The first draft of this document described the per-field AI-suggest flow as a "suggestion-review affordance" without checking what it actually does. Reading `ContentStudioScreen.jsx` directly: `handleSuggestBody()` calls the endpoint and then does `setBody(r.body)` — it writes the suggestion straight into the same local state the textarea is bound to. There is no separate accept/reject step, no diff, no preview. The code's own comment names this the *"fill-the-field pattern."* "Review" here means exactly what it means for anything else the tutor types: the field now holds the suggested text, it's still unsaved, the tutor can edit or delete any of it, and nothing reaches the server until they hit Save. That's the actual mechanism AIA-002/003/004 are satisfied by today — worth stating precisely, since the earlier draft's vaguer language could have been read as implying a distinct approve/discard control that doesn't exist.

**Extract, new.** Once a Resource's MIME type/extension identifies it as a PDF or image, an "Extract content" action appears next to it — visually and behaviorally consistent with the AI "suggest" buttons already inline on every lesson field. Clicking it calls the new endpoint (§4.3) and applies the identical fill-the-field mechanic to every non-null field the response returns in one action — `setTitle`, `setBody`, `setWhatYoullLearn`, `setLearningObjectives`, `setGlossary`, whichever came back non-null — instead of the tutor clicking five separate buttons.

**One real difference from the single-field case, worth deciding explicitly (see EXT-005 in §7).** A single "Suggest" click only ever affects the one field the tutor chose, so consent is implicit in which button they pressed. Extraction affects up to five fields from one click — if the tutor had already typed something into two of them before clicking Extract, the fill-the-field pattern's default (unconditional overwrite, matching `SuggestBodyAsync`'s own doc comment — *"drafts from the title if Content is empty, improves it otherwise"*) would silently discard unsaved work in fields the tutor didn't ask this action to touch. Recommendation: extraction should only fill fields that are currently empty, leaving any field the tutor has already started untouched — stricter than the single-field precedent, and deliberately so, because one click now stands in for what used to require five separate, individually-consented actions.

This restriction applies only to the Extract action, not to the field's own button. A field Extract skipped because it already had content still has its individual "Suggest" button sitting right there, unchanged — clicking it remains a deliberate, single-field, unconditional-overwrite request, exactly as it works today. Extraction filling four fields and leaving one alone doesn't disable that field's own regenerate option; the tutor can still ask AI to redo that one field on its own, the same way they could before this feature existed. The two mechanisms stay independent: one bulk, empty-fields-only, opt-out by not clicking Extract in the first place; one single-field, always-on, opt-in by clicking that field's own button.

**Why this, and not the video-lesson precedent's Accept/Edit/Remove list.** AI Interactive Video Lesson Generator §7 uses a "Suggested Interactive Timeline" list with Accept/Edit/Remove per item because its output is a *set of new items* (timeline-anchored questions) with no existing home to fill. Extraction's output is different in kind: it's suggested values for fields that already exist and already have an established, working fill-the-field flow. Reusing that mechanic is less new surface to build, and — more importantly — keeps the experience consistent with what a tutor already knows from the single-field AI buttons, rather than introducing a second, differently-shaped review pattern for what is conceptually the same action ("AI proposed this, I decide") applied to more fields at once.

**Governance compliance, explicit.** This satisfies AI Authoring Assistant Architecture's rules directly: AIA-001 (AI never publishes without approval — extraction never calls Save), AIA-002 (every suggestion optional — each field's suggestion can be ignored or overwritten), AIA-003 (every suggestion editable — same textarea the tutor already edits suggestions in today), AIA-004 (non-destructive — the empty-fields-only rule above is what makes this true for a multi-field action, not just an intention), and Lesson Revision Aggregate Design's INV-008 (AI-generated content remains editable before publication). No new invariant is needed; extraction is a new *source* for a suggestion, not a new kind of suggestion.

---

## 6. Restart-durability risk

Because §4.5 recommends synchronous execution for v1, this feature does **not** inherit `TranscriptionQueue`'s "job lost on restart" limitation — there is no queue to lose a job from. This is a genuine advantage of the sync design, not a gap being deferred. If a future revision moves extraction to an async/queued model (per §4.5's chunking scenario), that would be the moment to also raise a Technical Debt Backlog entry for the underlying limitation shared with `TranscriptionQueue` — today, neither has one, and a second undocumented instance of the same risk is worse than one.

---

## 7. Requirements for sign-off

Each is a recommended default, not a genuinely open question — confirm or override.

**EXT-001.** Extraction populates five fields — title, body, what-you'll-learn, learning objectives, glossary — matching the existing `ai-suggest-*` DTOs one-to-one (§4.2). Homework is excluded from v1.

**EXT-002.** `LearningAssetCategory` stays at two values (Video, Resource); PDF/image eligibility for extraction is determined by `ContentType`/extension at read time, not a new enum value. Separately — **revised after discussion, this is the one requirement that changed shape, not just got confirmed** — `LessonResource` gains a `VisibleToLearners` flag (default `true` for anything already attached, defaulting to `false` at upload time specifically for new PDF/image uploads, with a tutor-facing checkbox to override either way and a way to flip it later) so that attaching a file for extraction no longer forces it to become a student-facing download (§4.1). This is the actual fix for the concern raised: the two were wrongly conflated in the first draft.

**EXT-003.** Extraction is gated by the same entitlement check as transcript generation and every `ai-suggest-*` endpoint: `CapabilityDomain.Learning` at `AiAssistanceLevel.Assist` (§4.4). No new tier, pack, or pricing concept.

**EXT-004.** Extraction executes synchronously, in-request — no queue, no background service, no status field (§4.5). A PDF exceeding Claude's 32 MB/100-page limit fails a pre-flight check (§4.6) with a message pointing the tutor back at the plain-attach path, rather than being silently truncated or queued.

**EXT-005.** Extraction only fills currently-empty fields; a field the tutor has already started is left untouched (§5). This restricts only the bulk Extract action — each field's own individual "Suggest" button is unaffected, still available, and still overwrites unconditionally on click, exactly as it does today. This is the one recommendation that changes the *behavior* a tutor sees, not just the implementation, so it's the one most worth a deliberate yes/no rather than a skim.

**EXT-006.** One dispatching Skill, `learning.extract_resource_content`, handling both PDF and image via internal branching rather than two separately-registered Skills (§4.2).

**EXT-007.** Usage/credit metering and Workspace-level privacy/residency enforcement are pre-existing platform gaps (§4.9, §4.8) that extraction inherits unchanged rather than being asked to solve. Confirms this is acceptable scope, not an oversight.

**EXT-008.** Quiz-question generation from a PDF/image gets no new Skill, endpoint, or persisted field in v1 (§8) — it works through the existing Standalone Quiz "Suggest Questions" flow once extraction has filled and the tutor has saved the lesson fields. The raw-text grounding enhancement in §8 is deferred, not committed, pending a decision on how/whether to persist extracted text outside the five suggested fields.

**EXT-009.** Add `LessonDeliveryMode.Reading` (§9) — confirmed in discussion, not left as a limitation. A lesson built entirely from a PDF, with no video ever intended, must be publishable as its own delivery type rather than forced into `Recorded` (needs a video) or mislabeled as `LiveSession` (implies an actual scheduled class). This is a real domain and UI change, scoped in §9.

**EXT-010.** Add `LessonRevision.RequireQuizToComplete` (§10.3), a tutor-facing per-lesson toggle, default `false`. When on, a Reading lesson only completes once the student passes its Standalone Quiz; when off (every existing lesson, and any new one until a tutor opts in), today's auto-complete-on-open behavior is unchanged. Confirmed in discussion: this needed to be tutor-configurable, not a fixed platform rule.

**EXT-011.** ~~Homework/Learning Activity gating is out of scope~~ — **resolved, §11.** At the time this was written, no Assignment/Submission tracking system existed in code, so gating on homework had nothing to gate on. Assignment Aggregate Design and Assessment and Submission Aggregate Design v1.1 have since formalized both, and §11 below specifies a deliberately narrow v1 bridge — `HomeworkSubmission` — that lets a learner actually submit homework and a tutor evaluate it, without waiting on a full Assignment implementation (targeting, scheduling, due dates) this lesson-completion need doesn't require.

**EXT-012.** `RequireQuizToComplete` (EXT-010) is live in the domain layer — the field, its setter, and its API endpoint all exist and are callable — but is never actually read by the completion logic that was supposed to consult it, and has no tutor-facing UI to set it at all (§11.1). This is a bug to fix, not a design gap: §10.3's design was already correct; the implementation stopped short of finishing it.

**EXT-013.** Add a `HomeworkSubmission` entity — a learner's text and/or uploaded-file response to a lesson's `Homework` field, with a tutor (or later, AI-assisted) evaluation — plus the endpoints and UI (student submission form, tutor review screen) to use it (§11.2). Explicitly scoped as a v1 bridge referencing `LessonRevisionId` directly rather than a not-yet-built `AssignmentId`, expected to migrate onto the generalized Submission model once Assignment itself ships (Assessment and Submission Aggregate Design v1.1, §18).

**EXT-014.** Add `LessonRevision.RequireHomeworkToComplete` (bool, default `false`), a tutor-facing per-lesson toggle mirroring `RequireQuizToComplete`'s shape exactly. When on, a lesson with homework text only completes once the learner's `HomeworkSubmission` reaches **Submitted** — not Graded (§11.2's rationale: gating progress on tutor grading turnaround would strand learners indefinitely; "did they do the work" is the fairer bar for a completion gate than "did the tutor get to it yet"). Recommended default, not a closed decision — confirm or override.

**EXT-015.** `LessonProgress.RecomputeCompletion` gains two independent requirement checks (Standalone-quiz-required, homework-required), each collapsing to "satisfied" using the same "not applicable, or requirement met" pattern already used for video and Interactive assessment (§11.3). Every action that can change any one requirement's state (watch video, submit Interactive, submit Standalone, submit homework) must recompute all four together, exactly as `MarkVideoWatchedAsync` already does for video+Interactive today — this is what actually fixes EXT-012, not just reading the flag in one more place.

**EXT-016.** Homework Evaluation Method is fixed to Manual only in v1 — a tutor reviews and marks Passed/feedback themselves. AI-assisted evaluation (Assignment Aggregate Design §7's Evaluation Policy already names this as a legitimate mode) is a natural, low-effort follow-on — it would reuse `AiOrchestrator` exactly like every existing Skill — but is deferred, not built now, since nothing about finishing the Reading-lesson completion cycle requires it.

**EXT-017.** `HomeworkSubmission` is explicitly temporary scaffolding, not the final shape of homework delivery. It exists so a Reading lesson can require and gate on homework *today*, without first building the full Assignment aggregate (targeting, scheduling, due dates, attempt policy) that Assignment Business Analysis and Learning Activity Assignment Business Analysis already specify in full. When Assignment ships for real, `HomeworkSubmission` rows are expected to migrate to Assignment-target Submissions (Assessment and Submission Aggregate Design v1.1) with no change to the evidence they already recorded.

None of these block starting on the one piece that's needed regardless of how the rest resolve — the `IAiModelProvider`/`ClaudeModelProvider` multimodal extension (§3) has no dependency on EXT-001 through EXT-017. The endpoint, Skill, and UI wiring wait on sign-off, per the original request.

---

## 8. Quiz questions from a PDF — an emergent capability, plus one deferred enhancement

This wasn't part of the original request, but came up in discussion and is worth documenting rather than leaving as a verbal answer.

**Only the Standalone kind applies — Interactive doesn't, structurally, not by policy choice.** `AssessmentEnums.cs` defines `AssessmentKind { Interactive, Standalone }`. Interactive questions are timeline-anchored checkpoints inside a video (`GenerateQuestionsSkill`, gated on `request.VideoDurationSeconds > 0` — `AssessmentService.SuggestQuestionsAsync` rejects a zero/missing duration outright). A PDF has no timeline to anchor a checkpoint to, so Interactive Questions isn't a smaller-scope option here, it's simply inapplicable — there's no "place" for it in a video-less lesson, which is exactly what was observed. Standalone Quiz is the one built to be video-independent by design (its own doc comment: *"no video to place anything on — it's grounded in the lesson's own text"*), which is why it's the one that generalizes to PDF-sourced content.

**It already works, once extraction and Save both happen — no new Skill needed.** `GenerateStandaloneQuestionsSkill` — the engine behind the Standalone Quiz tab's existing "Suggest Questions" button — already grounds its questions in `revision.Body`, `revision.Transcript`, `revision.WhatYoullLearn`, `revision.LearningObjectives`, and `revision.Glossary` (confirmed directly in `AssessmentService.SuggestStandaloneQuestionsAsync`). That is exactly the field set extraction populates (§4.2). So once extraction fills those fields and the tutor accepts them, quiz generation is already grounded in the PDF's content, transitively, with zero new backend work.

**One sequencing detail that matters for the UX, not just an implementation footnote — and needs to actually be said to the tutor, not just documented here.** `SuggestStandaloneQuestionsAsync` loads `revision?.Body` etc. from the saved revision via `LoadTargetRevisionAsync` — it does not read unsaved form state the way `ai-suggest-*` and Extract do. So the real flow is Extract → tutor reviews/edits the filled fields → **Save** → *then* Suggest Questions sees the extracted content. Extracting and immediately clicking Suggest Questions without saving in between will generate questions from whatever the lesson had *before* extraction — silently, since nothing today distinguishes that case from a normal request (`ContentStudioScreen.jsx` has no dirty/unsaved-changes tracking anywhere else in the screen either, so this isn't a regression from some existing safeguard — there simply isn't one to reuse).

Concrete, minimal fix — copy only, no new state-tracking: extend the existing `studio.standaloneQuizHint` string (`translations.js`, rendered directly under the Standalone Quiz heading today: *"A separate quiz for this lesson, not tied to the video's timeline — its own title, passing threshold and Submission trail."*) to add a second sentence: *"Save the lesson first — questions are generated from your saved content, not what's still unsaved on this page."* Same treatment for the Extract button's own hint. Both languages need the update — this codebase's i18n is fully bilingual (English/Arabic; the existing hint's Arabic pair is at `translations.js`'s Arabic block). This is copy-level and doesn't require building unsaved-changes detection that doesn't exist anywhere else in the screen today; it tells the tutor the rule instead of trying to enforce it structurally.

**Gated separately, already, unrelated to this feature.** Quiz generation checks `HasAssessmentAiAsync` — the `Assessment` capability domain (Professional plan or the AI Assessment pack), not the `Learning` domain extraction uses (§4.4). That's the existing, pre-established gate for all standalone-quiz generation; nothing new to decide here.

**The real limitation, and why it's not fully solved by the above.** Quiz questions only ever see what extraction chose to put into the five summary fields — never the PDF's full text. Detail that's real and quiz-worthy (a specific figure, an edge case, an example) but reasonably left out of a tutor-facing summary is invisible to the question generator.

**Deferred enhancement, not built in v1 (EXT-008): ground quiz generation in the PDF's full extracted text.** `GenerateStandaloneQuestionsSkill.SuggestAsync` already has a `transcript` parameter that exists purely as supplementary grounding text for video lessons — the same slot could carry a PDF's extracted text for a PDF-based lesson. The extraction Skill could return this text alongside the five structured fields at effectively no extra cost (one multimodal call already reads the whole document). The reason this isn't simply added to v1: **something has to hold that text between the extraction call and whenever the tutor later clicks Suggest Questions**, and per EXT-004, extraction persists nothing today — the five suggested fields stay unsaved until the tutor explicitly saves them. Raw extracted text is a different kind of thing than a suggested field, though: it's grounding material, not authored content, closer in spirit to `Transcript` (which *is* persisted automatically, the moment transcription completes, with no separate tutor-approval step) than to `Body`/`Glossary`/etc. The natural design would be a new field — e.g. `LessonRevision.ExtractedResourceText` — persisted automatically on successful extraction the same way `Transcript` already is, decoupled from whether the tutor accepts any of the five suggested fields into the lesson. That's a real, if small, change to the "nothing is persisted" framing in §4.3, which is why it's flagged as a deferred decision (EXT-008) rather than folded silently into this pass.

---

## 9. Delivery mode: publishing a video-less, PDF-based lesson

A question, not a self-review finding this time — and it exposed a real gap that determines whether this feature can produce a *complete*, publishable lesson on its own, or only ever a drafting aid for a lesson that still needs a video.

**Today, a lesson without a video can only be published as `LiveSession`, and that's a lie for a reading lesson.** `LessonDeliveryMode` has exactly two values: `Recorded` and `LiveSession` (`ContentEnums.cs`). `Lesson.PublishDraft()` enforces this directly — *"A recorded lesson is nothing but its video"* — and throws if `DeliveryMode == Recorded` and no video/video URL is set. `LiveSession` is the only mode that already publishes without a video, but only because a live class doesn't need a pre-recorded file; the frontend's own copy for that mode calls the video an optional *recording*, and the student view prefixes the lesson with `learnerLesson.liveSessionPrefix` — genuinely live-session-specific language. Marking a PDF-based reading lesson as `LiveSession` to get past the publish check would tell students to expect a scheduled class that doesn't exist.

**Confirmed: add `LessonDeliveryMode.Reading`.** A third enum value — a self-paced, document-based lesson, no live component, no video required. What that actually touches, checked against the real code rather than assumed:

- **Backend publish validation needs no change at all.** `PublishDraft()`'s video check is already scoped to `DeliveryMode == LessonDeliveryMode.Recorded` specifically — a new `Reading` value falls outside that condition automatically, the same way `LiveSession` already does. Adding the enum value is close to sufficient on its own for the domain layer.
- **The student-facing view already renders a video-less lesson correctly — built for `LiveSession`, but not `LiveSession`-specific.** `LearnerLessonScreen.jsx` gates the video player on `(lesson.video || lesson.videoUrl)` and already has an explicit code comment for *"a video-less lesson"* completing immediately rather than waiting on playback. The only `LiveSession`-specific piece is the live-session banner (`isLive`-gated), which naturally won't render for `Reading` either, since that check stays `deliveryMode === "LiveSession"`. So the no-video rendering path this feature needs already exists, built for a different reason, and needs no new logic — only the mislabeling risk goes away.
- **What's actually new:** a third `<option>` in `ContentStudioScreen.jsx`'s delivery-type dropdown; extending the video-optional UI treatment (currently keyed on `isLive`) to also cover `Reading`, so the video dropzone reads as optional rather than required; and new copy (bilingual, per §8's precedent) — no "recording" framing, since a reading lesson never expects one, and no live-session banner on the student side.
- **Not proposed:** restricting `Reading` lessons from ever having a video. A tutor could still attach an illustrative clip to a primarily-PDF lesson; `Reading` only changes what's *required* to publish, the same relationship `LiveSession` already has to its optional recording.

**Nudging the tutor toward this, without deciding for them.** A tutor starting a new lesson defaults to `deliveryMode: "Recorded"` (`ContentStudioScreen.jsx`'s initial state). If they then use Extract with no video attached, they'd still hit the `Recorded` publish block until they notice the Delivery tab. Recommendation: when Extract runs and the lesson has no video, show a hint suggesting the tutor may want to switch Delivery Type to Reading — a suggestion, not an automatic change, consistent with AIA-004's non-destructive principle already established for every other part of this feature. Switching delivery mode is a tutor decision; extraction filling text fields is not license to change it on their behalf.

---

## 10. Student-side rendering, and a real completion bug this exposed

Also raised as a question, not a self-review finding — and the second half of it uncovered something that would have shipped broken if it hadn't been asked.

### 10.1 What replaces the video area

The building blocks already exist; nothing here needs a PDF-viewer library or a placeholder graphic. `LearnerLessonScreen.jsx` already renders `lesson.whatYoullLearn`/`lesson.body` as real text above where the video goes, and already has a "Resources" button (`onOpenResources`) opening the attached files. The one real gap is that the PDF/image itself sits one click away instead of being the lesson's visible centerpiece.

The fix reuses infrastructure that already exists for video: `learningAssetDownloadUrl(token, slug, assetId)` builds a URL with the auth token in the query string (`?access_token=...`) specifically so a plain `<video src>` can load it without a custom header — the identical URL works in an `<iframe>` (every major browser renders PDFs natively) or an `<img>`, no new backend endpoint or library required. Recommendation: when a lesson has no video but does have a `VisibleToLearners` PDF or image resource (§4.1), feature the first one (by `LessonResource.Position`, same ordering already used) inline, in the exact `.lw-learn__playerframe` slot the video currently occupies. Any additional resources stay reachable via the existing Resources button, the same relationship a video lesson already has to its own Resources.

### 10.2 The completion bug this surfaced

Checked `LearningDeliveryService.GetLessonAsync` directly, and the relevant branch says, in its own comment: *"A lesson with no video and no gradable Interactive assessment completes the moment it's opened — a Standalone quiz never gates this; it's a separate, optional thing a learner may also do."* That is exactly the shape of a Reading-mode lesson — no video, and Interactive questions structurally can't exist without one (§8). Under today's logic, a student opening a PDF-based lesson would be marked **Completed** the instant the page loads, before reading anything, regardless of whether a quiz exists or whether they take it. This is a real defect this feature would trigger, not a hypothetical.

Homework doesn't fix this, and can't yet. Checked `LessonRevision.cs`: `Homework` is a plain `string?` field — descriptive text a tutor writes or AI drafts, the same kind of thing as `Body` or `Glossary`. There is no `Assignment`/`LearningActivity` class anywhere in `Platform.Domain` today (confirmed by search) — the "delivered via a separate Assignment, with its own due date, attempt policy, submission window" model Lesson Revision Aggregate Design §7 describes is aspirational documentation, not built. There is nothing in the system that tracks whether a student has "done their homework" — no submission, no status, nothing to gate on. Making homework a completion requirement isn't a flag to flip; it's building the Assignment/Submission tracking system from scratch, which is its own project, well outside what this feature can reasonably absorb.

### 10.3 Completion policy: tutor-configurable, not a fixed platform rule

Per discussion, this isn't a single hardcoded behavior — the tutor decides, per lesson. New field: `LessonRevision.RequireQuizToComplete` (bool, default `false` — preserves every existing lesson's current behavior unchanged unless a tutor explicitly opts in). Surfaced as a toggle near the Standalone Quiz tab or the Delivery tab ("Require passing this quiz to mark the lesson complete"). When `true` and a passing Standalone submission doesn't yet exist, `GetLessonAsync`'s auto-complete branch does not fire — the lesson stays `InProgress` until the student passes the quiz, using the same `RecomputeCompletion(hasGradableAssessment, hasPassingSubmission)` call already used for Interactive assessments, just fed from the Standalone submission instead. When `false` (the default), today's behavior — auto-complete on open when there's no video and no gradable Interactive assessment — is unchanged.

Scoped deliberately to the video-less auto-complete branch for v1, not also wired into the video-watched-to-end completion path for `Recorded` lessons — that's a real, coherent extension (the same toggle could plausibly gate video-lesson completion on quiz-passing too) but it's a separate completion-policy decision for lessons this feature doesn't touch, not something to fold in silently here.

Homework/Learning Activity gating was, at the time this section was written, explicitly **not** part of this feature, for exactly the reason stated: no Assignment aggregate, no submission mechanism, no status to read. §11 below is that follow-up design, now that both exist at the Aggregate Design level.

---

## 11. Homework submission and completion gating — resolving EXT-011

### 11.0 What's changed since v1.5 — implementation has partially caught up to the design

This document was written as a pure design proposal with no code written yet. That's no longer entirely true. Checked directly against `Platform.Domain`/`Platform.Api` rather than assumed:

- **`LessonResource.VisibleToLearners` (§4.1, EXT-002) is implemented** — the field, its doc comment, and `SetVisibility` all exist exactly as designed.
- **`LessonDeliveryMode.Reading` (§9, EXT-009) is implemented** — the enum value exists, `Lesson.PublishDraft()`'s video check is scoped to `Recorded` exactly as this document anticipated (so `Reading` already skips it with no further backend change needed), and the code comment matches this document's own reasoning nearly verbatim.
- **`LessonRevision.RequireQuizToComplete` (§10.3, EXT-010) is *partially* implemented** — the field, its `SetRequireQuizToComplete` mutator, and a `ContentStudioController`/`ContentStudioService` endpoint to set it all exist. What doesn't exist is anything that actually *reads* it: `LearningDeliveryService.GetLessonAsync`'s auto-complete branch still only checks `!hasVideo && !hasGradableAssessment` (Interactive-scoped) and calls `RecomputeCompletion` with all three arguments hardcoded to the "nothing gates this" shape — `revision.RequireQuizToComplete` is not referenced anywhere in that method. `LearningDeliveryService.SubmitStandaloneAssessmentAsync` still carries its original doc comment verbatim — *"deliberately does not touch LessonProgress at all: the Standalone quiz is a separate, optional graded activity, not part of the lesson-completion rule"* — which was true when written and is now stale: it was written before `RequireQuizToComplete` existed, and nothing was updated when the field was added. There is also no tutor-facing UI for the toggle anywhere in `ContentStudioScreen.jsx` — confirmed by search, no matches. **The net effect: a tutor can call the endpoint and set `RequireQuizToComplete = true` today, through raw API access, and it will change nothing** — the lesson still auto-completes on open exactly as if the flag were `false`. §11.1 is the fix.
- **Homework (§10.2, EXT-011) is unchanged from v1.5's finding.** `HomeworkScreen.jsx` still renders `lesson.homework` as read-only text — confirmed directly, no input field, no submit button, no status indicator anywhere in the component. §11.2 is the resolution.

### 11.1 Fixing `RequireQuizToComplete` — a bug, not a redesign

The design in §10.3 was already correct; the implementation stopped one step short. Two concrete changes close the gap, both inside `LearningDeliveryService`:

1. **`GetLessonAsync`'s auto-complete branch must read the flag.** Today: `if (!hasVideo && !hasGradableAssessment) { progress.RecomputeCompletion(hasVideo: false, hasGradableAssessment: false, hasPassingSubmission: false); ... }` — unconditional. Needed: when `revision.RequireQuizToComplete` is `true`, the branch must instead check for a passing Standalone submission (the same `LoadStandaloneSummaryAsync` query the method already runs a few lines later for display purposes — the completion check and the display data should share one load, not query twice) before marking complete.
2. **`SubmitStandaloneAssessmentAsync` must call `RecomputeCompletion` when the flag is on.** Today it deliberately never does. Needed: after grading, if `revision.RequireQuizToComplete` is `true`, recompute completion using the just-recorded `submission.Passed` result — mirroring exactly how `SubmitAssessmentAsync` (the Interactive path) already recomputes completion immediately after grading.
3. **A tutor-facing toggle needs to exist at all.** Add it near the Standalone Quiz tab or the Delivery tab in `ContentStudioScreen.jsx`, calling the already-built `SetRequireQuizToComplete` endpoint — the backend half of this was finished; only the UI control was never added.

§11.3 below folds this fix into the same combined completion rule homework needs, rather than presenting them as two separate patches to the same method.

### 11.2 Homework Submission — a deliberately narrow v1 bridge

**Why not build the full Assignment aggregate first.** Assignment Aggregate Design (this corpus's newest document) formalizes Assignment in full — targeting from Enrollment, availability, due dates, submission windows, attempt policy, evaluation policy — and Assessment and Submission Aggregate Design v1.1 generalizes Submission to reference it. That is the right long-term model, and Homework is explicitly one of the fourteen Learning Activity types Learning Activity Assignment Business Analysis already names. But building it end to end — a real `LearningActivity` entity on Lesson Revision, a real `Assignment` aggregate with its own six-state lifecycle, recipient resolution from Enrollment — is a materially larger project than "let a Reading lesson require its homework to be submitted before it's marked complete," which is the actual, narrower ask here. Building the large version first would block the small, concrete need on a project with its own independent scope, timeline, and sign-off.

**The bridge: `HomeworkSubmission`, referencing `LessonRevisionId` directly.** A new entity, not a variant of the existing `Submission` class (which is intrinsically quiz-shaped: per-question `Answer`s, a single synchronous `Grade()` call against `Assessment.Grade()` — homework's shape, one free-form response evaluated once, doesn't fit that without forcing nullable-everything onto a table built for something else). Fields:

```csharp
public class HomeworkSubmission
{
    public Guid Id { get; }
    public Guid LessonRevisionId { get; }     // the v1 target — see the migration note below
    public Guid MembershipId { get; }         // submitter
    public Guid EnrollmentId { get; }
    public string? TextResponse { get; }
    public Guid? AttachedLearningAssetId { get; }   // an uploaded file, same storage path as LessonResource
    public HomeworkSubmissionStatus Status { get; } // Submitted, UnderReview, Graded
    public string? Feedback { get; }
    public bool? Passed { get; }
    public Guid? EvaluatedByMembershipId { get; }
    public DateTime SubmittedAt { get; }
    public DateTime? GradedAt { get; }
}
```

At least one of `TextResponse`/`AttachedLearningAssetId` is required to submit (mirrors Assessment and Submission Aggregate Design v1.1's new INV-007 for the generalized Response value object — same rule, same reasoning, applied here directly since this entity is that rule's concrete v1 instance). File upload reuses the exact same `ILearningAssetStorage`/`LearningAssetService` path `LessonResource` already uses — no new storage mechanism. Once `Graded`, a submission is immutable (mirrors `Submission.Grade()`'s existing "already graded" guard); resubmission after grading is `BA-008`'s "Return-for-Resubmission" concept, explicitly deferred, not built here.

**Why not "InProgress" as a state.** The existing `Submission`/`LessonProgress` pattern starts with a `Start()` call before any work is recorded. Homework doesn't need that: a learner fills in a text box and/or attaches a file, then submits — there's no meaningful "started but not yet submitted" server-side state worth persisting for a v1 that has no draft-save requirement. The row is created at the moment of submission.

**Endpoints** (new, `LearningDeliveryController`, alongside the existing `SubmitStandalone` action):

- `POST .../lessons/{lessonId}/homework/submit` — learner-facing, body `{ textResponse, attachedLearningAssetId }`, creates a `HomeworkSubmission` at `Submitted`.
- `GET content-studio/.../lessons/{lessonId}/homework-submissions` — tutor-facing, lists submissions for the lesson's current revision (author-only, same authority model as every other Content Studio endpoint).
- `POST content-studio/.../homework-submissions/{id}/evaluate` — tutor-facing, body `{ passed, feedback }`, transitions to `Graded`.

**Frontend.** `HomeworkScreen.jsx` gains what it's missing entirely today: a response form (text area + the same file-upload control `ContentStudioScreen.jsx`'s Resources section already uses) below the read-only instructions text, a Submit button, and a status area showing Submitted / Under Review / Graded with feedback once evaluated. A new tutor-facing screen — "Homework Submissions," reachable from the lesson's Content Studio view the same way Standalone Quiz results would be — lists each learner's response with Pass/Not-yet/feedback controls, the tutor-facing mirror of the new student form.

### 11.3 The combined completion rule — finishing the cycle

This is the actual "finish the cycle" fix: one consistent rule, not two separate patches for quiz and homework bolted on independently.

`LessonProgress.RecomputeCompletion` gains two more requirement/satisfaction pairs, following the exact pattern its own two existing ones (`hasVideo`/`VideoWatched`, `hasGradableAssessment`/`hasPassingSubmission`) already use — "not applicable, or requirement met":

```csharp
public void RecomputeCompletion(
    bool hasVideo,
    bool hasGradableAssessment, bool hasPassingSubmission,             // Interactive — unchanged
    bool requireStandaloneQuiz, bool hasPassingStandaloneSubmission,   // new — EXT-012
    bool requireHomework, bool homeworkSubmitted)                      // new — EXT-013/014
{
    if (Status == Completed) return;
    var videoSatisfied = !hasVideo || VideoWatched;
    var interactiveSatisfied = !hasGradableAssessment || hasPassingSubmission;
    var standaloneSatisfied = !requireStandaloneQuiz || hasPassingStandaloneSubmission;
    var homeworkSatisfied = !requireHomework || homeworkSubmitted;

    if (videoSatisfied && interactiveSatisfied && standaloneSatisfied && homeworkSatisfied)
    {
        Status = LessonProgressStatus.Completed;
        CompletedAt = DateTime.UtcNow;
    }
}
```

`requireStandaloneQuiz` is `revision.RequireQuizToComplete`; `requireHomework` is `revision.RequireHomeworkToComplete && !string.IsNullOrWhiteSpace(revision.Homework)` — a tutor can't require homework a lesson doesn't have. Both new requirements stay scoped, deliberately, to the same video-less auto-complete branch §10.3 already scoped `RequireQuizToComplete` to — not also wired into the video-watched-to-end completion path for `Recorded` lessons. That's a real, coherent future extension (nothing structurally prevents a video lesson from also requiring its homework) but it's a separate completion-policy decision this document isn't making on Recorded lessons' behalf.

**The part that actually matters for correctness, not just adding parameters:** every action that can change *any* one of these four requirements' satisfaction must recompute all four together, every time — the same discipline `MarkVideoWatchedAsync` already follows today (it recomputes `hasGradableAssessment`/`hasPassingSubmission` even though only `VideoWatched` just changed, because otherwise a stale value could either falsely complete or falsely fail to complete the lesson). Concretely, `GetLessonAsync`, `SubmitStandaloneAssessmentAsync`, and the new homework-submit endpoint each need to resolve the *current* state of all four dimensions before calling `RecomputeCompletion` — worth factoring into one shared private helper (something like `ResolveCompletionInputsAsync(revision, membershipId, ct)`) rather than duplicating four queries in three places, but that's an implementation-organization detail, not a design decision this document needs to pin down further.

---

## 12. Local (Ollama) multimodal support — full local dev parity, no Claude API required

Raised in discussion: the dev workflow intended for this feature is a local agent (Ollama) through development, with Claude reserved for production — not because Claude API access requires a subscription in the Claude.ai sense (it doesn't; it's pay-as-you-go, billed per call to an API key), but because the preference is genuinely zero external dependency and zero cost while iterating. §3's original recommendation — extend `ClaudeModelProvider` only, leave every other provider free to opt in later "independently... whether and when" — already anticipated this as a valid path, not a workaround. This section is Ollama exercising that option, for both images and PDFs.

**Images: a direct extension.** Ollama's chat API already accepts a per-message `"images"` array of base64-encoded image bytes (confirmed against Ollama's current API docs, 2026-08-16) — no PDF support in that field, images only. `OllamaModelProvider` gains the `IAiModelProvider` attachment overload it doesn't implement today (it currently falls to the interface's default `NotSupportedException`, which is exactly what §11.1's dev-environment bug report hit): when `attachments` is non-empty, each image attachment's bytes go straight into that array.

**PDFs: need a local rendering step first, since Ollama has none of Claude's native document support.** A new local-only pipeline: render each PDF page to an image before handing it to the vision model. Recommended library: `PDFtoImage` (NuGet, PDFium-backed, cross-platform, no external Ghostscript/process dependency — a single C# call per page). This is genuinely new surface (a new package dependency, a new conversion step) that doesn't exist anywhere in this codebase today — confirmed, no PDF-rendering library is referenced anywhere in `Platform.Api`.

**New configuration: `Ai:Ollama:VisionModel`, separate from `Ai:Ollama:Model`.** The existing `Model` (`qwen2.5:7b` in dev) is text-only — most single local models aren't both a strong text model and a strong vision model, so this needs its own setting, used only when attachments are present. Empty/unset fails clearly, matching `AiOptions.ApiKey`'s existing fail-fast discipline: *"`Ai:Ollama:VisionModel` is not configured — pull a vision-capable model (e.g. `ollama pull llama3.2-vision`, `ollama pull qwen2.5vl`, or `ollama pull llava`) and set this before requesting AI extraction locally."*

**Sketch (illustrative, not final code):**

```csharp
public async Task<string> CompleteAsync(
    string systemPrompt, string userPrompt, IReadOnlyList<AiAttachment> attachments,
    bool jsonMode = false, Type? responseType = null, CancellationToken ct = default)
{
    if (attachments.Count == 0)
        return await CompleteAsync(systemPrompt, userPrompt, jsonMode, responseType, ct);

    if (string.IsNullOrWhiteSpace(options.VisionModel))
        throw new InvalidOperationException(
            "Ai:Ollama:VisionModel is not configured — pull a vision-capable model and set this first.");

    var images = attachments.SelectMany(a =>
        a.MediaType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase)
            ? RenderPdfPagesToBase64Images(a.Data)   // PDFtoImage, capped at MaxLocalPdfPages
            : [Convert.ToBase64String(a.Data)]
    ).ToList();

    // ...same request/response handling as the existing text-only path,
    // using options.VisionModel instead of options.Model, with `images`
    // added to the user message.
}
```

**A local page cap, deliberately much lower than Claude's — stated plainly, not hidden.** `MaxLocalPdfPages`, recommended around 20: rendering and reasoning over dozens of full-resolution page images on a local model is slow and most local vision models degrade badly with many images in one request, unlike Claude's 100+/600-page ceiling (§4.6), which is a real API limit, not a quality one. A local test PDF longer than the cap gets only its first `MaxLocalPdfPages` pages considered — this should log a visible note when it happens (*"Only the first 20 of 45 pages were sent to the local model — full-document extraction is a Claude-only capability today"*), not truncate silently, so a developer doesn't mistake a partial local result for a complete one.

**The quality difference is real and worth saying up front, not discovering by surprise.** Local vision models (llava/moondream/qwen2.5vl/llama3.2-vision, depending what's pulled) are meaningfully weaker at document-style reading and OCR than Claude's vision. Expect noisier, sparser, or occasionally empty extraction results during local testing that aren't representative of what Claude will produce in production — that's model capability, not a broken pipeline. Recommendation: use clean, simple, digital-text PDFs and images for local dev iteration, and run a real Claude pass (a handful of API calls, not a subscription) before finalizing copy, thresholds, or anything that depends on extraction quality specifically.

**Architecturally, this changes nothing about §3's decision, only who exercises it.** The interface (`IAiModelProvider`'s attachment overload, `Provider Isolation`'s default `NotSupportedException`) is unchanged; Ollama is simply the second provider — after Claude — to opt in, exactly as §3 already said any provider could. `AiOrchestrator` and `ExtractLessonContentFromResourceSkill` need no changes at all — provider selection is still purely `Ai:Provider` config in `Program.cs`, and both providers now honor the same `AiAttachment` input shape, each translating it to its own vendor's request format.

---

## Summary

The two decisions already made — keep the plain attach path, add an extract action alongside it — turn out to fit this codebase's existing patterns closely rather than requiring new infrastructure. The multimodal gap is real but narrow (`ClaudeModelProvider` needs content-block support Claude's API already offers); the async-job machinery that transcription needed doesn't apply at this workload's size; the entitlement question has a working precedent to copy rather than invent; and the UX is best served by reusing the exact fill-the-field mechanic already built and confirmed in the actual frontend code, extended with one new safety rule (fill empty fields only) that a single-field button never needed. This pass closed two rounds of gaps: the first added the real Claude API size/page limits, the concrete failure-mode shapes, and an honest accounting of two platform-wide gaps (usage metering, privacy/residency enforcement) this feature inherits rather than introduces; the second — raised in discussion, not by a self-review — caught that attaching a file and making it downloadable to students were the same unconditional action in this codebase, and fixed it with one new boolean rather than a structural change. What's proposed is still additive everywhere it touches: a new provider capability, one new Skill, one new endpoint, four new fields (`VisibleToLearners`, `LessonDeliveryMode.Reading`, `RequireQuizToComplete`, plus reusing the existing video-slot rendering for an inline PDF/image), and one new button — no existing behavior changes beyond the new defaults for newly-uploaded PDFs/images and (opt-in only) stricter completion. Three more findings came from questions asked in review rather than self-checks, all real: generating quiz questions from a PDF needs nothing new in v1, since it already works through the existing Standalone Quiz flow once extraction fills the lesson fields and the tutor saves; a lesson built purely from a PDF couldn't actually be *published* under either existing delivery mode, closed by adding `Reading` as a third mode that needed almost no new logic since the video-less rendering path already existed, built for `LiveSession`; and a question about what students would even see exposed a real completion bug — a Reading lesson would mark itself done the instant it opened — fixed with a tutor-configurable toggle rather than a fixed rule, while homework-gating was initially confirmed out of scope entirely, since nothing in the codebase tracked whether homework was ever done.

**§11 (v1.6) is the follow-up that closes that last gap, and it landed differently than either extreme.** Not "still out of scope" — Assignment and Submission are now both formalized at the Aggregate Design level, so there's something real to gate on. But also not "build the full Assignment aggregate" — that's a materially larger project (targeting, scheduling, due dates, attempt policy) than "let a Reading lesson require homework before completing," so §11.2 specifies `HomeworkSubmission`, an explicit, temporary v1 bridge referencing the Lesson Revision directly rather than a not-yet-built Assignment, expected to migrate onto the generalized model once Assignment ships for real. Checking the actual implementation state while writing this revision also surfaced something this document didn't expect to find: `RequireQuizToComplete` (EXT-010) had already been built at the domain layer since v1.5 — field, mutator, endpoint all present — but was never wired into either place that should read it, and has no UI to set it. That toggle has been sitting live in the codebase doing nothing. §11.1 and §11.3 fix both gaps — the quiz-completion wiring that was silently incomplete, and the homework-completion feature that didn't exist at all — with one consistent completion rule instead of two separate patches.
