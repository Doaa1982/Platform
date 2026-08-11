# Student-Side AI Roadmap

Companion to [AI-Student-Capabilities-One-Pager.md](./AI-Student-Capabilities-One-Pager.md). Phased by build effort and dependency, not just impact — earlier phases also lay the groundwork (content indexing, source grounding) that later phases need.

## Phase 1 — Foundation + Quick Wins (0–3 months)

**Goal:** stand up the grounding infrastructure and ship the highest-impact, lowest-complexity feature.

- **Content indexing pipeline** — ingest and chunk syllabus, slides, readings, and lecture transcripts per course so they're retrievable by AI. *Effort: Medium. Impact: Enabling (blocks everything below).*
- **Grounded Q&A over course materials** — chat interface scoped to one course's indexed content, with citations to the source slide/timestamp. *Effort: Medium. Impact: High.* This is the flagship NotebookLM-style feature and should ship first.
- **Accessibility layer** — auto-transcripts and read-aloud for existing video/audio content. *Effort: Low–Medium. Impact: Medium, broad reach.* Can run in parallel with Q&A since it doesn't depend on the indexing pipeline in the same way.

## Phase 2 — Study Aids (3–6 months)

**Goal:** turn indexed content into active study tools, building directly on Phase 1's pipeline.

- **Auto-generated summaries, flashcards, and quizzes** from a specific lecture or reading. *Effort: Medium. Impact: High, daily-use feature.*
- **Audio overviews** (podcast-style recap of a lecture). *Effort: Medium–High (TTS + dialogue generation). Impact: Medium-High, strong differentiator and shareable/viral within student base.*
- **Multi-source synthesis** — combine several weeks of materials into one study guide or mind map. *Effort: Medium. Impact: Medium-High.*

## Phase 3 — Personalization (6–9 months)

**Goal:** connect AI to each student's own performance data, not just static content.

- **Performance-driven learning paths** — surface specific gaps from quiz/assignment history and recommend exact content to revisit. *Effort: Medium-High (needs analytics integration). Impact: High, main retention/outcomes lever.*
- **Socratic tutoring mode** for homework help — guided hints instead of direct answers. *Effort: High (careful prompt design, guardrails, instructor trust-building). Impact: High, but reputationally sensitive — worth piloting with instructor opt-in first.*

## Phase 4 — Deep Integration (9–12+ months)

**Goal:** tie AI feedback into the actual assessment and grading loop.

- **Rubric-grounded writing/code feedback** — AI review of drafts against the instructor's actual rubric before submission. *Effort: High (per-assignment rubric ingestion, subject-specific grading logic). Impact: High, but needs strong instructor buy-in and QA to avoid undermining grading integrity.*

## Sequencing Notes

- Phase 1's indexing pipeline is the dependency everything else sits on — don't skip ahead.
- Socratic tutoring and rubric feedback are the two features most likely to draw scrutiny from instructors/parents (academic integrity concerns) — pilot both with a small instructor group and clear opt-in before broad rollout.
- Audio overviews are optional/parallel — deprioritize if engineering bandwidth is tight, since they add cost (TTS) without being core to learning outcomes.
