# UI Interaction Conventions

Concrete, implementation-level interaction rules for the frontend — distinct
from Experience Architecture's Portal/Bounded-Context principles, which stay
technology-independent by design. This document is where a specific choice
about how a control *behaves* gets written down once and then simply applied,
rather than re-decided screen by screen. New entries append; nothing here is
removed once decided unless explicitly superseded.

Status values: `Active` · `Superseded`

---

## UIC-001 — Explanatory text goes in a tooltip, not printed under the field

**Decided:** 2026-08-06
**Applies to:** every screen, authenticated or not
**Status:** Active

When a form field or option needs explaining — what a choice means, what will
happen, a constraint the label alone doesn't convey — that explanation is
revealed on hover/focus via a small "i" affordance next to the label. It is
**not** printed as permanent text sitting under the field.

This reverses an earlier explicit choice (visible in `ProductsScreen.jsx`'s
Pacing/Enrollment fields prior to this date, which argued the opposite: that a
choice a tutor "makes once and lives with" should have its meaning readable
without hunting for it). That reasoning is overridden going forward — the
always-on hint text made simple forms feel dense and full of homework before a
tutor had asked for any of it. A form should read as short as it looks, with
depth available on demand rather than forced on every reader whether they
need it or not.

**Does not apply to** real-time, state-dependent feedback — validation
errors, "why this button is disabled" messages, save/publish outcome
notices, or beginner-onboarding guidance meant to stay visible without
requiring an interaction to discover (e.g. the numbered curriculum-building
steps in `ContentStudioScreen.jsx`, or a status-timeline legend like
`WorkspaceSetupScreen.jsx`'s step blurbs). Those must stay visible by
default: a user should never have to guess to hover in order to find out why
something is blocked, or to orient themselves in a multi-step flow.

**Implementation:** `frontend/src/components/InfoTip.jsx` — a small shared
component, `<InfoTip text="…" />`, placed inline next to a field's label. It
is styled with fixed inline values rather than this app's `var(--ink)`-style
theme tokens, because those tokens are only ever defined inside each screen's
own scoped CSS (there is no shared root theme across authenticated and
public screens) — inline styles are what let one component drop into any
screen, logged in or not, without that screen having to register anything
for it.

Applied so far: `ProductsScreen.jsx` (Pacing, Enrollment mode),
`ApplyScreen.jsx` (Email), `JoinScreen.jsx` (Password). Apply the same
pattern to any future field-level explanation rather than reintroducing a
`<small>` hint under the input.
