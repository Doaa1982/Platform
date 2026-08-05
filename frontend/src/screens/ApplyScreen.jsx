import { ArrowLeft, Mail, Construction } from "lucide-react";
import { useFonts } from "../hooks/useFonts";

/* =========================================================================
   APPLY — /apply, the destination of the landing page's single call to action.

   The Tutor Signup Request it leads to is specified (Platform Administrator
   Business Analysis §7.1) but not built, and building it is gated on
   Technical Debt Backlog TD-011 — it and Join Request are the same business
   pattern at two scopes, and whether they share an abstraction should be
   decided before the second one exists.

   So this page says so, plainly, rather than presenting a form that silently
   discards what someone types. A signup form that looks real and stores
   nothing is worse than an honest "not yet": it costs the applicant their
   time and the platform its credibility.
   ========================================================================= */

export default function ApplyScreen({ onBack, onSignIn }) {
  useFonts();

  return (
    <div className="pl-apply">
      <style>{CSS}</style>

      <div className="pl-apply__card">
        <button type="button" className="pl-apply__back" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" /> Back
        </button>

        <div className="pl-apply__mark" aria-hidden="true"><Construction size={22} /></div>
        <div className="pl-apply__eyebrow">Become a tutor</div>
        <h1>Applications aren't open yet</h1>

        <p className="pl-apply__lead">
          Tutor signup is designed but not yet built, so there's nothing here that
          would actually reach us — and we'd rather tell you that than take your
          details and lose them.
        </p>

        <div className="pl-apply__how">
          <h2>How it will work</h2>
          <ol>
            <li>You apply, telling us who you are and what you teach.</li>
            <li>We review the application and approve or decline it.</li>
            <li>Approved tutors set up payment and get their own workspace.</li>
            <li>You invite your learners in and start publishing.</li>
          </ol>
        </div>

        <p className="pl-apply__muted">
          <Mail size={13} aria-hidden="true" /> In the meantime, get in touch directly and
          we'll set you up by hand.
        </p>

        <button className="pl-apply__ghost" onClick={onSignIn}>
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}

const CSS = `
  .pl-apply {
    --ink: #F2F5FA; --ink-soft: #98A2B5; --accent: #5B8DEF;
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink);
    background: #0B0F16; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
  }
  .pl-apply *, .pl-apply *::before, .pl-apply *::after { box-sizing: border-box; }

  .pl-apply__card {
    width: 100%; max-width: 470px;
    background: #12171F; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px; padding: 32px 30px;
  }
  .pl-apply__back {
    display: inline-flex; align-items: center; gap: 5px; background: transparent;
    border: none; padding: 0; margin-bottom: 20px; font-family: inherit;
    font-size: 0.82rem; color: var(--ink-soft); cursor: pointer;
  }
  .pl-apply__back:hover { color: var(--ink); }

  .pl-apply__mark {
    width: 46px; height: 46px; border-radius: 12px; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(91,141,239,0.16); color: var(--accent);
  }
  .pl-apply__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px;
  }
  .pl-apply h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.5rem; font-weight: 600; margin: 0 0 12px; }
  .pl-apply__lead { color: var(--ink-soft); font-size: 0.92rem; line-height: 1.65; margin: 0 0 26px; }

  .pl-apply__how {
    background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 11px; padding: 18px 20px;
  }
  .pl-apply__how h2 {
    font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    letter-spacing: 0.09em; text-transform: uppercase; font-weight: 500;
    color: var(--ink-soft); margin: 0 0 12px;
  }
  .pl-apply__how ol { margin: 0; padding-left: 18px; color: var(--ink-soft); font-size: 0.87rem; line-height: 1.75; }
  .pl-apply__how li::marker { color: var(--accent); }

  .pl-apply__muted {
    display: flex; align-items: center; gap: 7px;
    font-size: 0.82rem; color: var(--ink-soft); margin: 22px 0 20px; line-height: 1.55;
  }
  .pl-apply__ghost {
    width: 100%; font-family: inherit; font-size: 0.88rem; font-weight: 600;
    color: var(--ink); background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.14); border-radius: 10px;
    padding: 11px 16px; cursor: pointer;
  }
  .pl-apply__ghost:hover { background: rgba(255,255,255,0.11); }
  .pl-apply__ghost:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
