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

---

## UIC-002 — Mandatory fields are marked, validated, and shown when an attempt fails

**Decided:** 2026-08-06
**Applies to:** every form with required fields, authenticated or not
**Status:** Active

Three parts, always together:

1. **A required control is marked at the label**, not just discovered after a
   rejected submit — a small red asterisk next to the label text.
2. **The action button stays enabled.** It does not silently disable itself
   when required data is missing, leaving someone to guess why nothing
   happens when they click it.
3. **Pressing it with missing or invalid data shows exactly what's wrong** —
   a message naming the problem (not a generic "invalid form"), and the
   offending control's border turns the same red as its asterisk. Both clear
   the moment the person fixes that field, without needing another submit
   attempt.

This replaces two prior patterns, both now considered wrong for this app:
disabling the submit button until every required field already validates
(the earlier pattern in `ProductsScreen.jsx`'s `ProductForm`, `ApplyScreen.jsx`
and `JoinScreen.jsx`), and relying on the browser's native `required`
validation popup, which is unstyled, inconsistent across browsers, and gives
no way to explain *why* something is required. Native `required` attributes
stay on the underlying controls for assistive-technology semantics, but each
`<form>` carries `noValidate` so the browser's own popups never fire — all
feedback is this app's own.

**Does not apply to** the constant "why is this disabled" captions that
already existed for state the person can't fix by editing a field in this
same form — e.g. a Publish button blocked by something outside the form
being edited. Those keep whatever display they already had; this convention
is specifically about *this form's own* required fields.

**Implementation:** `frontend/src/components/RequiredMark.jsx` exports the
asterisk component (`<RequiredMark />`, purely visual — `aria-hidden`, since
the control's own `required` attribute already carries the a11y semantics)
and `invalidFieldStyle`, the shared red border style applied to a control
via `style={attempted && !valid ? invalidFieldStyle : undefined}`. Both use
fixed inline values for the same portability reason as `InfoTip` (UIC-001) —
no shared root theme to key off of.

The surrounding pattern is a local `attempted` boolean, set `true` only when
a submit is actually rejected for missing/invalid data, read back to decide
whether to show the asterisk-red border and an inline `.lw-studio__alert` /
`.lw-prod__alert` / `.pl-*__alert`-style message (each screen's own existing
error-box styling, reused rather than duplicated) naming what's missing.
Because the check re-runs on every render, both the border and the message
disappear on their own the instant the field becomes valid — no separate
reset needed.

Applied so far: `ProductsScreen.jsx` (`ProductForm`'s Title),
`ApplyScreen.jsx` (name, email), `JoinScreen.jsx` (name, email, password),
`ContentStudioScreen.jsx` (`NewUnitForm`, `NewLessonOnlyForm`, `UnitCard`'s
add-lesson field, `LessonEditor`'s draft Title and publish-requires-content
check, `QuestionForm`'s prompt and its per-type answer-key requirements).
Not yet converted: `LoginScreen.jsx`, `InviteScreen.jsx`, `AdminScreen.jsx`,
`WorkspaceSetupScreen.jsx`, `MembersScreen.jsx`. Apply the same pattern
there the next time one of those forms is touched, rather than reintroducing
a disabled-until-valid button.

**Addendum, 2026-08-06:** a field with no `<RequiredMark />` is already
implied optional by this convention, so a label additionally spelling out
`(optional)` next to it is redundant and was removed everywhere it appeared
(`ProductForm`'s Description/Category/Language/Tags, `ApplyScreen.jsx` and
`JoinScreen.jsx`'s optional textareas, `LessonEditor`'s Estimated minutes,
`QuestionForm`'s Explanation/Guidance and Video timestamp). Where the
parenthetical carried other information beyond optionality (`(comma
separated)`, `(seconds)`, `(shown after answering)`), that part stayed —
only the word "optional" itself was redundant. Don't reintroduce it on a
new optional field; the absence of the asterisk already says it.

---

## UIC-003 — Add/edit forms: one property per row, label left, value right

**Decided:** 2026-08-06
**Applies to:** every screen that adds or edits a record's properties,
authenticated or not
**Status:** Active

A form that lets someone fill in or change a record's properties lists them
one per row — the property's name in a left column, its control (input,
textarea, select, or a composite control such as a segmented type-picker) in
a right column that starts at the same horizontal position on every row of
that form. It replaces the earlier pattern of a label sitting on its own
line directly above its control, stacked top-to-bottom.

This generalizes a display-only pattern that already existed for *reading* a
record — `ProductsScreen.jsx`'s `.lw-prod__proplist` and
`WorkspaceSetupScreen.jsx`'s read-only `Field` component both already showed
one property per row, label column then value column. The change is to use
that same shape while the value is *editable*, not just when it's static
text — so a record reads the same way whether you're looking at it or
changing it.

**Implementation:** each form's own wrapping class (e.g. `.lw-prod__form`,
`.lw-studio__draftform`, `.pl-apply__form`) becomes a CSS grid,
`grid-template-columns: max-content 1fr`, one row per property
(`row-gap`, no `column-gap` smaller than about 14px so the two columns don't
crowd). Every `<label>` (or field-wrapper `<div>`, e.g.
`.lw-studio__minsfield`) inside gets `display: contents` — this is the load-
bearing trick: it removes the label's own box from layout entirely, so its
`<span>` (the property name) and its control become direct children of the
grid and land in column 1 and column 2 automatically, without restructuring
any JSX. Existing field markup (`<label><span>Title</span><input/></label>`)
needed no change anywhere this was applied — only the CSS did.

Anything that isn't a single label+control pair — an alert box, a helper
paragraph, a multi-part answer-key editor (`.lw-options`), an actions row —
is a normal (non-`contents`) direct child of the same grid, so it gets
`grid-column: 1 / -1` to span both columns rather than being squeezed into
the label column. A narrow-viewport media query (~480–560px, per form)
drops back to the old stacked layout, since a fixed label column stops
making sense once there isn't room for two columns side by side.

**Does not apply to** a single quick-add field with no separate label at all
(`ContentStudioScreen.jsx`'s `NewUnitForm`/`NewLessonOnlyForm`, `UnitCard`'s
inline add-lesson field) — there is only one property, so there is no row
list to align. Also does not apply to sign-in/credential forms
(`LoginScreen.jsx`, `AdminLogin.jsx`) — a password prompt is not editing a
record's properties, and `LoginScreen.jsx`'s two-pane marketing layout in
particular is a deliberately different shape this convention isn't meant to
override.

Applied so far: `ProductsScreen.jsx` (`ProductForm`), `WorkspaceSetupScreen.jsx`
(`IdentityForm`), `MembersScreen.jsx` (`InviteForm` — which previously had no
visible labels at all; Email/Role labels were added as part of this change),
`AdminScreen.jsx` (`ProvisionForm`), `ContentStudioScreen.jsx`
(`LessonEditor`'s Content/Delivery tabs, `VideoSection`'s URL field,
`QuestionForm`), `ApplyScreen.jsx`, `JoinScreen.jsx`, `InviteScreen.jsx`.
Apply the same grid to any new add/edit form rather than reintroducing a
stacked label-above-control field.

---

## UIC-004 — A page's or panel's own header is centered

**Decided:** 2026-08-06
**Applies to:** every screen and modal/panel, authenticated or not
**Status:** Active

The title that belongs to a page or a panel — its eyebrow line plus its
`h1` (a page) or `h2` (a panel/modal) — is centered on that page or panel,
rather than sitting flush against the left edge. This replaces the default
left-aligned block behavior every bare `h1`/`.lw-eyebrow` had before.

**Does not apply to** the body copy underneath a header: `.lw-sub`'s
descriptive paragraph, a lead paragraph, or "how this works" style text
stays left-aligned — centering is for the short title itself, not for
justified or centered prose, which reads worse the longer it gets. It also
does not apply to section dividers *within* a page (`h2.lw-sectiontitle`
things like "Requests to join" or "Not yet in a unit") — those mark a
subsection of content the reader is already inside, not the page's own
header, and stay left-aligned exactly as before.

Where a header shares a line with something else, the something else moves
rather than the header losing its centering:

- `ContentStudioScreen.jsx`'s `.lw-studio__heading` (a title beside a status
  pill, used for the curriculum builder's `h1`, the lesson panel's `h2`, and
  the assessment section's `h2`) changed from a left-aligned flex row to a
  centered one (`justify-content: center`) — title and pill center as a
  unit.
- `AdminScreen.jsx`'s workspace-list header used to put the title on the
  left and its action buttons (Refresh / Provision / Sign out) on the right
  in one row. That row is now two: the centered title on top, the actions
  centered in a row underneath — the actions didn't have anywhere sensible
  to go otherwise once the title itself was centered rather than pinned
  left.

**Implementation:** for the shared dashboard shell, this is one shared rule
(`h1`, `.lw-eyebrow` in `App.jsx`'s CSS) that every screen using that shell
inherits for free. Standalone screens (`ApplyScreen.jsx`, `AdminScreen.jsx`,
`AdminLogin.jsx` — each with their own root CSS, no shared shell) needed the
same `text-align: center` added directly to their own header rules.
`JoinScreen.jsx` and `InviteScreen.jsx` needed no change here — their card
was already `text-align: center` for its header, from before this
convention existed (their form fields already had their own `text-align:
left` override, which is exactly the same override this convention's grid
now carries forward).

**Does not apply to** `LoginScreen.jsx` — its two-pane marketing layout
(brand aside + form panel) is a deliberately different shape; forcing its
panel's title to center against that layout's own left-aligned typography
would fight the design rather than match it.

Applied so far: `App.jsx` shared shell (covers `ProductsScreen.jsx`,
`ContentStudioScreen.jsx`, `WorkspaceSetupScreen.jsx`, `MembersScreen.jsx`),
`ApplyScreen.jsx`, `AdminScreen.jsx`, `AdminLogin.jsx`.
