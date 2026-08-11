import { HelpCircle, Layers, GitBranch, Headphones } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";

/* =========================================================================
   STUDIO — the on-demand-output panel that sits alongside the Assistant's
   chat, same pattern NotebookLM's own Studio panel uses: everything here is
   generated from the exact same grounded lesson material the Assistant
   answers questions from, just reshaped into a different study format.

   Quiz is real, but lives on its own subscreen (QuizScreen) rather than
   inline here — generating and retaking a quiz wants its own page, not a
   modal stacked on top of the chat. This tile is just a second door to it,
   alongside the lesson page's own "Quiz" button. Flashcards, Mind Map and
   Audio Overview are shown as real, named, disabled tiles — not silently
   absent — so the shape of where this is going is visible without
   pretending they already work (same NotBuiltYet honesty this app already
   uses elsewhere).
   ========================================================================= */

export default function StudioPanel({ onOpenQuiz }) {
  const { t } = useLanguage();

  return (
    <div className="lw-studio">
      <style>{CSS}</style>
      <div className="lw-studio__title">{t("learnerStudio.title")}</div>

      <div className="lw-studio__grid">
        <button type="button" className="lw-studio__tile" onClick={onOpenQuiz}>
          <HelpCircle size={16} />
          <span>{t("learnerStudio.quiz")}</span>
        </button>
        <StudioTile icon={Layers} labelKey="learnerStudio.flashcards" />
        <StudioTile icon={GitBranch} labelKey="learnerStudio.mindMap" />
        <StudioTile icon={Headphones} labelKey="learnerStudio.audioOverview" />
      </div>
    </div>
  );
}

function StudioTile({ icon: Icon, labelKey }) {
  const { t } = useLanguage();
  return (
    <div className="lw-studio__tile is-disabled" aria-disabled="true">
      <Icon size={16} />
      <span>{t(labelKey)}</span>
      <span className="lw-studio__soon">{t("learnerStudio.comingSoon")}</span>
    </div>
  );
}

const CSS = `
  .lw-studio { margin-top: 22px; max-width: 72ch; }
  .lw-studio__title { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); margin-bottom: 10px; }
  .lw-studio__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .lw-studio__tile {
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 14px 14px; font-family: var(--font-body); font-size: 0.85rem; color: var(--ink);
    cursor: pointer; text-align: left;
  }
  .lw-studio__tile:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
  .lw-studio__tile.is-disabled { cursor: default; color: var(--ink-soft); position: relative; }
  .lw-studio__tile.is-disabled:hover { border-color: var(--line); }
  .lw-studio__soon {
    font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em;
    background: var(--surface-2); color: var(--ink-soft); border-radius: 20px; padding: 2px 8px;
  }
`;
