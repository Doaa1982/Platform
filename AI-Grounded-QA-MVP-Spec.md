# MVP Spec: Grounded Q&A Over Course Materials

Companion to [AI-Student-Capabilities-One-Pager.md](./AI-Student-Capabilities-One-Pager.md) and [AI-Student-Capabilities-Roadmap.md](./AI-Student-Capabilities-Roadmap.md) — Phase 1 flagship feature.

## Problem

Students need quick, trustworthy answers about their course content, but generic AI chatbots either hallucinate, answer from outside the syllabus, or can't point to where an answer came from — none of which instructors or students can trust for actual coursework.

## Goal

Let a student ask a question about a specific course and get an answer generated only from that course's own materials, with a visible citation (source document + slide/timestamp) for every answer.

## Scope (MVP)

**In scope:**
- One course at a time (student selects or is already inside a course context)
- Source types: syllabus, slide decks (PDF/PPT), readings (PDF/text), lecture transcripts (from video/audio already on the platform)
- Text-based chat interface, single-turn and short follow-up threads
- Every answer includes at least one citation linking back to the source location
- "I don't know" fallback when the answer isn't in the course materials — explicitly avoid answering from general knowledge

**Out of scope for MVP:**
- Cross-course synthesis (multiple courses at once) — Phase 2
- Audio overviews / flashcards / quizzes — Phase 2
- Personalization based on grade/performance history — Phase 3
- Voice input/output

## User Flow

1. Student opens a course and clicks "Ask about this course" (persistent entry point, e.g., a panel or button on the course home page).
2. Student types a question in natural language.
3. System retrieves relevant chunks from that course's indexed materials, generates an answer, and returns it with inline citations (e.g., "Lecture 4, slide 12" or "Reading: Chapter 3, p. 45").
4. Student can click a citation to jump to that exact slide/page/timestamp.
5. If no relevant material is found, the system says so plainly and suggests rephrasing or checking with the instructor — it does not answer from general knowledge.
6. Student can ask a follow-up in the same thread; context carries over within that session.

## Data Requirements

- **Content indexing pipeline**: ingest syllabus, slides, readings, and transcripts per course; chunk and embed for retrieval (this is the shared dependency called out in the roadmap's Phase 1).
- **Metadata per chunk**: source document, page/slide number or timestamp, course ID — required for citations to work.
- **Freshness**: re-index when an instructor updates or adds materials (near-real-time or nightly batch is likely sufficient for MVP).
- **Access control**: a student can only query materials for courses they're enrolled in.

## Technical Requirements (high level)

- Retrieval-augmented generation (RAG): vector search over indexed chunks + LLM for answer generation, constrained to retrieved context only.
- Prompt/guardrails to suppress answers when retrieval confidence is low (avoid confident-sounding wrong answers).
- Logging of question/answer pairs for quality review and instructor visibility (with student privacy considered — see open questions).

## Success Metrics

- **Adoption**: % of enrolled students who use it at least once per course, weekly active usage.
- **Answer quality**: sampled instructor review of a random set of Q&A pairs for accuracy (target a defined pass rate, e.g., 90%+ correctly grounded).
- **Trust signal**: % of answers with a citation the student actually clicks through to verify.
- **Deflection**: reduction in repetitive basic-content questions to instructors/TAs (survey or support-channel volume, if trackable).

## Risks / Open Questions

- Should instructors see a log of what students are asking? Useful for spotting confusing content, but raises privacy considerations — needs a policy decision.
- How to handle courses with sparse or poorly structured materials (e.g., scanned handwritten notes) — may need OCR or a "content not yet available" state.
- Cost per query at scale — needs a rough estimate before committing to unlimited usage per student.
- Should instructors be able to review/approve the indexed content before it's queryable, or is auto-indexing acceptable?

## Suggested Pilot

Launch with a small number of volunteer courses/instructors (5–10) for one term, instrumented for the metrics above, before platform-wide rollout.
