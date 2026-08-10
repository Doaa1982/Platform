import Modal from "./Modal";

/* =========================================================================
   SPLIT STEP MODAL — the two-pane "are you sure" pattern used for anything
   that changes what a Workspace pays for (Cancel, Upgrade, Downgrade,
   Reactivate): a fixed eyebrow/title bar, a decorative side panel carrying
   the step's headline, and a content pane for whatever that step needs
   (bullets, a reason picker, a success state, ...). One component so every
   commercial decision reads as the same considered moment instead of a
   different ad-hoc confirm dialog per action.
   ========================================================================= */
export default function SplitStepModal({ eyebrow, headline, description, onClose, closeLabel, children }) {
  return (
    <Modal onClose={onClose} closeLabel={closeLabel} panelClassName="lw-splitmodal__panel">
      <div className="lw-splitmodal__header">{eyebrow}</div>
      <div className="lw-splitmodal__body">
        <div className="lw-splitmodal__side">
          <span className="lw-splitmodal__shape lw-splitmodal__shape--circle" aria-hidden="true" />
          <span className="lw-splitmodal__shape lw-splitmodal__shape--triangle" aria-hidden="true" />
          <div className="lw-splitmodal__sidetext">
            <h2 className="lw-splitmodal__headline">{headline}</h2>
            {description && <p className="lw-splitmodal__description">{description}</p>}
          </div>
        </div>
        <div className="lw-splitmodal__content">{children}</div>
      </div>
    </Modal>
  );
}

export const SPLIT_STEP_MODAL_CSS = `
  .lw-splitmodal__panel { max-width: 760px; padding: 0; overflow: hidden; }
  .lw-splitmodal__header {
    padding: 15px 50px 15px 22px; border-bottom: 1px solid var(--line);
    font-weight: 700; font-size: 0.92rem; color: var(--ink);
  }
  .lw-splitmodal__body { display: flex; min-height: 380px; }
  .lw-splitmodal__side {
    flex: 0 0 40%; position: relative; overflow: hidden; padding: 26px;
    background: color-mix(in srgb, var(--accent-2) 20%, var(--surface));
    display: flex; flex-direction: column; justify-content: flex-end;
  }
  .lw-splitmodal__shape { position: absolute; }
  .lw-splitmodal__shape--circle {
    width: 92px; height: 92px; border-radius: 50%; top: -22px; inset-inline-end: -22px;
    background: color-mix(in srgb, var(--accent-2) 45%, transparent);
  }
  .lw-splitmodal__shape--triangle {
    width: 0; height: 0; bottom: 22px; inset-inline-start: 22px; opacity: 0.85;
    border-inline-start: 32px solid transparent; border-inline-end: 32px solid transparent;
    border-bottom: 52px solid color-mix(in srgb, #E0A83E 75%, transparent);
  }
  .lw-splitmodal__sidetext { position: relative; }
  .lw-splitmodal__headline { font-family: var(--font-display); font-size: 1.4rem; line-height: 1.25; margin: 0 0 8px; }
  .lw-splitmodal__description { font-size: 0.84rem; color: var(--ink); opacity: 0.75; margin: 0; max-width: 30ch; }
  .lw-splitmodal__content { flex: 1; padding: 26px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }

  @media (max-width: 620px) {
    .lw-splitmodal__body { flex-direction: column; }
    .lw-splitmodal__side { flex: none; padding: 20px; }
  }
`;
