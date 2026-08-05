import { Hammer, ArrowRight } from "lucide-react";

/* =========================================================================
   NOT BUILT YET — for workspace areas whose domain does not exist.

   These screens previously rendered fixture data: courses nobody wrote,
   learners nobody enrolled, revenue nobody earned. Harmless in a prototype
   shown to stakeholders; actively misleading now that real tutors sign in and
   see it presented as their own academy.

   This replaces that with the truth. It deliberately shows no zeroed metrics
   either — a "0 enrolled" implies the feature works and the answer is zero,
   when in fact nothing is measuring anything.
   ========================================================================= */

export default function NotBuiltYet({ area, blurb, next, onNavigate }) {
  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{area}</div>
      <h1>Not built yet</h1>

      <div className="lw-nby">
        <span className="lw-nby__icon" aria-hidden="true"><Hammer size={20} /></span>
        <div>
          <p className="lw-nby__lead">{blurb}</p>
          <p className="lw-nby__note">
            Nothing here is measured yet, so rather than show you zeros — or worse,
            numbers belonging to nobody — this page says what's actually true.
          </p>
          {next && (
            <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={() => onNavigate(next.to)}>
              {next.text} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .lw-nby {
    display: flex; gap: 16px; align-items: flex-start;
    background: var(--surface); border: 1px dashed var(--line);
    border-radius: var(--radius-sm); padding: 24px 26px; max-width: 62ch;
  }
  .lw-nby__icon {
    width: 42px; height: 42px; border-radius: var(--radius-sm); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-nby__lead { font-size: 0.95rem; margin: 0 0 10px; line-height: 1.6; }
  .lw-nby__note { font-size: 0.85rem; color: var(--ink-soft); margin: 0 0 16px; line-height: 1.6; }
`;
