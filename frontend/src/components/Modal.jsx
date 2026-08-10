import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/* =========================================================================
   MODAL — a real, focused popup dialog: fixed full-viewport dimmed overlay,
   a centered panel, Escape-to-close, and focus moved into the panel on open
   and restored to whatever triggered it on close.

   Extracted after a real bug: ConfigureModal (Billing) and the product
   editor (ProductsScreen) both used lw-prod__overlay/lw-prod__panel, but
   only ProductsScreen ever defined that CSS — opening the modal from
   Billing rendered fully unstyled, inline divs (no fixed position, no
   dimming, no focus) since ProductsScreen's <style> tag wasn't mounted.
   One real component removes the class of bug, not just this instance of it.
   ========================================================================= */
export default function Modal({ onClose, closeLabel, children, panelClassName = "" }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();

    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div className="lw-modal__overlay" onClick={onClose}>
      <div
        className={`lw-modal__panel ${panelClassName}`}
        role="dialog" aria-modal="true" tabIndex={-1} ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="lw-modal__close" onClick={onClose} aria-label={closeLabel}><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

export const MODAL_CSS = `
  .lw-modal__overlay {
    position: fixed; inset: 0; background: rgba(10,12,15,0.55);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 20px; z-index: 50; overflow-y: auto;
  }
  .lw-modal__panel {
    background: var(--surface); color: var(--ink); border-radius: var(--radius);
    max-width: 640px; width: 100%; padding: 30px 32px 34px; position: relative;
    outline: none;
  }
  .lw-modal__close { position: absolute; top: 18px; inset-inline-end: 18px; background: transparent; border: none; cursor: pointer; color: var(--ink-soft); }
  .lw-modal__close:hover { color: var(--ink); }
  .lw-modal__title { margin: 2px 0 18px; text-align: center; }
  .lw-modal__actions { display: flex; justify-content: flex-end; gap: 8px; }
`;
