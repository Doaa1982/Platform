import { GraduationCap, BookOpen, ArrowRight } from "lucide-react";
import { SIDES } from "../auth/sides";
import { useFonts } from "../hooks/useFonts";

/* =========================================================================
   SIDE CHOOSER — the front door at "/".

   Asks which door, not who you are. The answer only picks a login screen and
   a surface; the roles on your Membership still decide what you can do once
   you are inside.
   ========================================================================= */

const ICONS = { teach: GraduationCap, learn: BookOpen };

export default function SideChooser({ onChoose }) {
  useFonts();

  return (
    <div className="pl-chooser">
      <style>{CSS}</style>

      <div className="pl-chooser__inner">
        <div className="pl-chooser__eyebrow">Platform</div>
        <h1 className="pl-chooser__title">Where are you headed?</h1>
        <p className="pl-chooser__sub">
          Choose how you're using the platform today. If you both teach and learn,
          you can switch at any time without signing in again.
        </p>

        <div className="pl-chooser__cards">
          {Object.values(SIDES).map((side) => {
            const Icon = ICONS[side.key];
            return (
              <button
                key={side.key}
                className={`pl-choice pl-choice--${side.key}`}
                onClick={() => onChoose(side.path)}
              >
                <span className="pl-choice__icon" aria-hidden="true"><Icon size={24} /></span>
                <span className="pl-choice__title">{side.chooser.title}</span>
                <span className="pl-choice__blurb">{side.chooser.blurb}</span>
                <span className="pl-choice__go">
                  Continue <ArrowRight size={15} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .pl-chooser {
    --ink: #1B2430; --ink-soft: #6A7383; --line: #E1DED7; --surface: #FFFFFF;
    font-family: 'Karla', system-ui, sans-serif;
    color: var(--ink); background: #F7F5F1;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 48px 24px;
  }
  .pl-chooser *, .pl-chooser *::before, .pl-chooser *::after { box-sizing: border-box; }

  .pl-chooser__inner { width: 100%; max-width: 720px; text-align: center; }
  .pl-chooser__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--ink-soft); margin-bottom: 12px;
  }
  .pl-chooser__title {
    font-family: 'Fraunces', Georgia, serif; font-weight: 600;
    font-size: clamp(1.9rem, 4vw, 2.5rem); margin: 0 0 10px; line-height: 1.1;
  }
  .pl-chooser__sub {
    color: var(--ink-soft); font-size: 0.96rem; line-height: 1.6;
    max-width: 48ch; margin: 0 auto 34px;
  }

  .pl-chooser__cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  .pl-choice {
    display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
    text-align: left; font-family: inherit; color: inherit;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 16px; padding: 26px 24px; cursor: pointer;
    transition: border-color .15s, box-shadow .15s, transform .15s;
  }
  .pl-choice:hover { transform: translateY(-2px); box-shadow: 0 6px 22px rgba(27,36,48,0.09); }
  .pl-choice:focus-visible { outline: 2px solid var(--accent, #2D5BD1); outline-offset: 2px; }
  .pl-choice--teach { --accent: #2D5BD1; }
  .pl-choice--learn { --accent: #1E7F63; }
  .pl-choice:hover { border-color: var(--accent); }

  .pl-choice__icon {
    display: flex; align-items: center; justify-content: center;
    width: 46px; height: 46px; border-radius: 12px;
    background: var(--accent); color: #fff; margin-bottom: 8px;
  }
  .pl-choice__title { font-family: 'Fraunces', Georgia, serif; font-size: 1.25rem; font-weight: 600; }
  .pl-choice__blurb { color: var(--ink-soft); font-size: 0.89rem; line-height: 1.55; }
  .pl-choice__go {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 12px; font-size: 0.86rem; font-weight: 600; color: var(--accent);
  }

  @media (max-width: 620px) {
    .pl-chooser__cards { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pl-choice { transition: none; }
    .pl-choice:hover { transform: none; }
  }
`;
