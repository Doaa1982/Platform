import { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import { THEME_TOGGLE_CSS } from "../theme/ThemeToggle";
import { MODAL_CSS } from "../components/Modal";
import { PLAN_PICKER_CARDS_CSS } from "../components/PlanPickerCards";
import { ACCOUNTBAR_COMPACT_PX, NAV_BREAKPOINT_PX } from "./breakpoints";

/* =========================================================================
   APP CSS — every .lw-* component style (buttons, fields, cards, messages,
   the shell). Rendered once by App.jsx and once by EntryShell, so an entry
   screen's button *is* the app's button rather than a lookalike. Moved here
   unchanged from App.jsx.
   ========================================================================= */

export const APP_CSS = `
  .lw-root { font-family: var(--font-body); color: var(--ink); background: var(--bg); min-height: 100vh; display: flex; flex-direction: column; }
  .lw-root * { box-sizing: border-box; }

  /* Modern Sticky Glassmorphic Account & Nav Bar */
  .lw-accountbar {
    position: sticky; top: 0; z-index: 100;
    background: color-mix(in srgb, var(--bar-bg) 88%, transparent);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    color: var(--bar-ink); border-bottom: 1px solid var(--bar-line);
    font-family: var(--font-body); font-size: 12px;
    display: flex; align-items: center; gap: 12px; padding: 10px 24px; flex-wrap: wrap;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }
  .lw-accountbar__side { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; background: var(--side-accent); color: #fff; border-radius: 20px; padding: 3px 9px; }
  .lw-accountbar__ws { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12.5px; }
  .lw-accountbar__roles { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .lw-accountbar__role { font-family: var(--font-mono); font-size: 10px; background: var(--bar-role-bg); color: var(--bar-role-ink); border-radius: 20px; padding: 2px 8px; font-weight: 500; }
  .lw-accountbar__spacer { flex: 1; }
  .lw-accountbar button {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: 1px solid var(--bar-line); color: var(--ink-soft);
    border-radius: 9999px; padding: 5px 12px; font-family: var(--font-body); font-size: 11.5px; font-weight: 500;
    cursor: pointer; transition: all .18s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lw-accountbar button:hover {
    color: var(--bar-ink); border-color: var(--bar-hover-line);
    background: var(--surface-2, rgba(0,0,0,0.04)); transform: translateY(-1px);
  }
  .lw-accountmenu { position: relative; }
  .lw-accountbar .lw-accountmenu__trigger {
    background: var(--surface); border: 1px solid var(--line); color: var(--ink);
    padding: 4px 10px 4px 4px; font-weight: 600;
  }
  .lw-accountbar .lw-accountmenu__trigger:hover { border-color: var(--bar-hover-line); }
  .lw-accountmenu__avatar {
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--accent); color: #fff;
    font-family: var(--font-body); font-weight: 700; font-size: 0.75rem;
  }
  .lw-accountmenu__avatar--lg { width: 36px; height: 36px; font-size: 0.95rem; }
  .lw-accountmenu__chev { color: var(--ink-soft); transition: transform .18s ease; }
  .lw-accountmenu__trigger[aria-expanded="true"] .lw-accountmenu__chev { transform: rotate(180deg); }
  .lw-accountmenu__panel {
    position: absolute; top: calc(100% + 8px); inset-inline-end: 0; z-index: 41;
    width: 250px; overflow: hidden; padding: 6px;
    background: var(--bar-bg); color: var(--bar-ink); border: 1px solid var(--bar-line); border-radius: 12px;
    box-shadow: 0 12px 36px var(--bar-panel-shadow);
  }
  .lw-accountmenu__id { display: flex; align-items: center; gap: 10px; padding: 8px 8px 10px; }
  .lw-accountmenu__idtext { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .lw-accountmenu__idname { font-weight: 700; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lw-accountmenu__idemail { font-size: 0.76rem; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lw-accountmenu__divider { height: 1px; background: var(--bar-line); margin: 4px 4px; }
  .lw-accountbar .lw-accountmenu__item {
    display: flex; width: 100%; justify-content: flex-start; gap: 8px;
    background: transparent; border: 1px solid transparent; color: var(--bar-ink);
    border-radius: 8px; padding: 8px; font-weight: 500;
  }
  .lw-accountbar .lw-accountmenu__item:hover { background: var(--bar-hover-bg, var(--surface-2, rgba(0,0,0,0.05))); transform: none; }
  .lw-accountbar .lw-accountmenu__item--danger { color: var(--danger); }
  .lw-accountbar .lw-accountmenu__item--danger:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); }
  @media (max-width: ${ACCOUNTBAR_COMPACT_PX}px) {
    .lw-accountmenu__name { display: none; }
    .lw-accountbar .lw-accountmenu__trigger { padding: 4px; border-color: transparent; background: transparent; }
  }

  .lw-accountbar__navlinks { display: inline-flex; align-items: center; gap: 6px; }
  .lw-accountbar .lw-accountbar__navlink {
    border-color: transparent; border-radius: 9999px; padding: 5px 14px; font-weight: 500;
  }
  .lw-accountbar .lw-accountbar__navlink:hover {
    background: var(--surface-2, rgba(0,0,0,0.05)); color: var(--bar-ink);
  }
  .lw-accountbar .lw-accountbar__navlink.is-active {
    color: var(--accent); border-color: color-mix(in srgb, var(--accent) 30%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, var(--bar-bg)); font-weight: 600;
  }
  .lw-accountbar__more { position: relative; }
  .lw-accountbar__morepanel {
    position: absolute; top: calc(100% + 8px); inset-inline-start: 0; z-index: 41;
    width: 210px; overflow: hidden;
    background: var(--bar-bg); color: var(--bar-ink); border: 1px solid var(--bar-line); border-radius: 12px;
    box-shadow: 0 12px 36px var(--bar-panel-shadow);
    display: flex; flex-direction: column; padding: 6px;
    animation: lwFadeIn 0.2s ease;
  }
  .lw-accountbar .lw-accountbar__moreitem {
    display: flex; align-items: center; gap: 9px; width: 100%; text-align: start;
    background: transparent; border: none; color: var(--bar-ink); border-radius: 8px;
    padding: 9px 12px; font-family: var(--font-body); font-size: 12px; font-weight: 500; cursor: pointer;
    transition: background 0.15s ease;
  }
  .lw-accountbar__moreitem svg { color: var(--ink-soft); flex-shrink: 0; }
  .lw-accountbar .lw-accountbar__moreitem:hover { background: var(--bar-hover-bg); color: var(--ink); }
  .lw-accountbar .lw-accountbar__moreitem.is-active { background: var(--bar-active-bg); color: var(--bar-active-ink); font-weight: 600; }

  @media (max-width: ${ACCOUNTBAR_COMPACT_PX}px) {
    .lw-accountbar { gap: 5px; padding: 6px 12px; }
    .lw-accountbar button { gap: 3px; padding: 4px 7px; }
    .lw-accountbar__ws { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lw-accountbar__ws svg { flex-shrink: 0; }
  }

  .lw-notifbell { position: relative; }
  .lw-accountbar .lw-notifbell__trigger {
    position: relative; padding: 6px; border-radius: 50%; border: 1px solid transparent;
  }
  .lw-accountbar .lw-notifbell__trigger:hover { border-color: var(--bar-line); background: var(--surface-2, rgba(0,0,0,0.04)); }
  .lw-notifbell__badge {
    position: absolute; top: -2px; inset-inline-end: -2px;
    min-width: 15px; height: 15px; padding: 0 3px; border-radius: 50%;
    background: var(--danger); color: #fff;
    font-family: var(--font-mono); font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; line-height: 1;
  }
  .lw-notifbell__scrim { position: fixed; inset: 0; z-index: 40; }
  .lw-notifbell__panel {
    position: absolute; top: calc(100% + 8px); inset-inline-end: 0; z-index: 41;
    width: 320px; max-height: 380px; overflow-y: auto;
    background: var(--bar-bg); color: var(--bar-ink); border: 1px solid var(--bar-line); border-radius: 12px;
    box-shadow: 0 12px 36px var(--bar-panel-shadow);
  }
  .lw-notifbell__head {
    font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ink-soft); padding: 12px 14px 8px;
  }
  .lw-notifbell__empty { font-size: 0.83rem; color: var(--ink-soft); padding: 6px 14px 16px; }
  .lw-notifbell__list { list-style: none; margin: 0; padding: 0 6px 6px; display: flex; flex-direction: column; gap: 2px; }
  .lw-notifbell__list li { padding: 9px 8px; border-radius: 8px; cursor: pointer; }
  .lw-notifbell__list li:hover { background: var(--bar-hover-bg); }
  .lw-notifbell__list li.is-unread { background: var(--bar-unread-bg); }
  .lw-notifbell__list li.is-unread:hover { background: var(--bar-unread-hover-bg); }
  .lw-notifbell__list strong { display: block; font-size: 0.85rem; }
  .lw-notifbell__list p { font-size: 0.8rem; color: var(--ink-soft); margin: 3px 0 5px; line-height: 1.45; }
  .lw-notifbell__time { font-family: var(--font-mono); font-size: 9.5px; color: var(--ink-soft); }

  .lw-controlstrip { background: #0D0F12; color: #C9CDD3; font-family: var(--font-mono); font-size: 11px; display: flex; align-items: center; gap: 20px; padding: 8px 18px; flex-wrap: wrap; border-bottom: 1px solid #000; }
  .lw-controlstrip__label { opacity: 0.65; letter-spacing: 0.04em; }
  .lw-controlstrip__group { display: flex; align-items: center; gap: 6px; }
  .lw-controlstrip__group span { opacity: 0.6; margin-inline-end: 2px; }
  .lw-controlstrip button { background: transparent; border: 1px solid #383D45; color: #C9CDD3; border-radius: 20px; padding: 3px 10px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; transition: all .15s; }
  .lw-controlstrip button.active { background: #C9CDD3; color: #0D0F12; border-color: #C9CDD3; }
  .lw-controlstrip__new { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: 1px dashed #4A5058 !important; color: #8FE3EA !important; border-radius: 20px; padding: 3px 10px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; }
  .lw-controlstrip__reset { margin-inline-start: auto; display: flex; align-items: center; gap: 5px; background: transparent; border: none; color: #8A8F97; cursor: pointer; font-family: var(--font-mono); font-size: 11px; }

  /* Centralized, Refined Academy Header */
  .lw-academyheader {
    width: 100%; background: linear-gradient(135deg, var(--accent), var(--accent-2));
    padding: 16px 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  }
  .lw-academyheader__inner {
    max-width: 1080px; margin: 0 auto; width: 100%;
    display: flex; align-items: center; gap: 16px;
  }
  .lw-academyheader__mark {
    background: rgba(255,255,255,0.18); padding: 7px; border-radius: 12px;
    display: flex; flex-shrink: 0; backdrop-filter: blur(4px);
  }
  .lw-academyheader__name {
    font-family: var(--font-body, system-ui); font-weight: 700; font-size: 1.4rem;
    line-height: 1.2; color: #fff; letter-spacing: -0.01em;
  }
  .lw-academyheader__tagline { font-size: 0.85rem; color: rgba(255,255,255,0.9); margin-top: 2px; }
  @media (max-width: 640px) {
    .lw-academyheader { padding: 14px 16px; }
    .lw-academyheader__name { font-size: 1.15rem; }
  }

  .lw-shell { display: flex; flex: 1; min-height: 0; }
  .lw-content {
    flex: 1; overflow-y: auto; padding: 32px 32px 64px; position: relative;
    background: var(--bg);
  }
  .lw-page {
    max-width: 1080px; margin: 0 auto; width: 100%; box-sizing: border-box;
    animation: lwFade .25s ease;
  }
  @keyframes lwFade { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .lw-page { animation: none; } }

  /* Modern typography hierarchy */
  h1 { font-family: var(--font-body, system-ui); font-weight: 700; font-size: 2rem; margin: 4px 0 10px; line-height: 1.25; letter-spacing: -0.02em; text-align: center; }
  h2.lw-sectiontitle { font-family: var(--font-body, system-ui); font-size: 1.25rem; margin: 32px 0 14px; font-weight: 700; letter-spacing: -0.01em; }
  .lw-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; text-align: center; }
  .lw-sub { color: var(--ink-soft); font-size: 0.95rem; max-width: 62ch; margin: 0 auto 24px; text-align: center; line-height: 1.55; }

  .lw-nav { width: 250px; flex-shrink: 0; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; padding: 22px 16px; position: relative; }
  /* Leather-ledger touch: a stitched edge along the sidebar's inner border,
     standing in for a bound spine. Tutor side only — the Student side gets
     the perforated-page treatment on .lw-academyheader instead. */
  .lw-root--owner .lw-nav::after {
    content: ""; position: absolute; top: 14px; bottom: 14px; inset-inline-end: 8px; width: 1px;
    background-image: repeating-linear-gradient(to bottom, var(--accent-2) 0 5px, transparent 5px 10px);
    opacity: 0.5; pointer-events: none;
  }
  .lw-nav__brand { display: flex; gap: 10px; align-items: center; margin-bottom: 28px; }
  .lw-brandmark { flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden; display: flex; line-height: 0; }
  .lw-cover { width: 100%; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; }
  .lw-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lw-cover svg { display: block; }
  /* Bumped from 0.92rem and given a touch of letter-spacing (2026-08-15) —
     the Tutor's Caveat script and the Student's Kalam both get cramped on a
     workspace name at chrome-label size, and this label can't control how
     long that name is. Kept at .lw-nav (sidebar) scale, not shrunk further
     for any workspace with a long name. */
  .lw-nav__name { font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; line-height: 1.25; letter-spacing: 0.1px; }
  .lw-nav__tagline { font-size: 10.5px; opacity: 0.6; margin-top: 2px; }
  .lw-nav__items { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
  .lw-nav__divider { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.45; padding: 12px 12px 4px; }
  .lw-nav__item { display: flex; align-items: center; gap: 9px; background: transparent; border: none; color: var(--nav-text); opacity: 0.72; padding: 8px 12px; border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 0.84rem; cursor: pointer; text-align: start; transition: all .15s; }
  .lw-nav__item:hover { opacity: 1; background: rgba(255,255,255,0.06); }
  .lw-nav__item.is-active { opacity: 1; background: var(--accent); color: var(--on-accent, #fff); }
  .lw-nav__profile { display: flex; align-items: center; gap: 8px; background: transparent; border: 1px dashed rgba(255,255,255,0.25); color: var(--nav-text); opacity: 0.75; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 0.75rem; cursor: pointer; margin: 6px 0; }
  .lw-nav__profile:hover { opacity: 1; }
  .lw-nav__person { display: flex; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.14); }
  /* color explicit (2026-08-15, WCAG pass) — otherwise inherits --nav-text
     from .lw-nav, which fails badly against --accent-2 in TUTOR_DARK/
     STUDENT_DARK (3.29:1 / 2.07:1). */
  .lw-nav__avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-2); color: var(--on-accent-2, #fff); display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 600; flex-shrink: 0; }
  .lw-nav__personname { font-size: 0.8rem; font-weight: 600; }
  .lw-nav__personrole { font-size: 0.7rem; opacity: 0.6; }

  /* Opens the sidebar drawer below NAV_BREAKPOINT_PX — CSS-hidden above it,
     where .lw-nav is back to a static column and there's nothing to toggle. */
  .lw-accountbar button.lw-accountbar__hamburger { display: none; }
  .lw-navbackdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 45; }

  @media (max-width: ${NAV_BREAKPOINT_PX}px) {
    .lw-accountbar button.lw-accountbar__hamburger { display: inline-flex; }
    .lw-nav {
      position: fixed; top: 0; bottom: 0; inset-inline-start: 0; z-index: 50;
      transform: translateX(-100%); transition: transform .25s ease;
      box-shadow: 4px 0 24px rgba(0,0,0,0.28);
    }
    [dir="rtl"] .lw-nav { transform: translateX(100%); }
    .lw-nav.is-open { transform: translateX(0); }
    .lw-content { padding: 20px 18px 40px; }
    /* The margin rule (.lw-content::before, desktop default 34px) sits inside
       this narrower padding otherwise, putting it mid-content instead of in
       the gutter — pull it in to match. */
    .lw-root--learner .lw-content::before { inset-inline-start: 10px; }
    /* The in-lesson Learner sidebar has the same fixed-width problem as
       .lw-nav, but it's a content menu, not primary chrome — stacking it
       above the lesson instead of a second off-canvas drawer keeps this
       simple. */
    .lw-shell:has(.lw-lessonnav) { flex-direction: column; }
    .lw-lessonnav { width: 100%; max-height: 220px; border-inline-end: none; border-bottom: 1px solid var(--line); }
  }

  /* The Learner side's left-sidebar slot, in-lesson only */
  .lw-lessonnav {
    width: 320px; flex-shrink: 0; overflow-y: auto;
    background: var(--surface); border-inline-end: 1px solid var(--line);
    display: flex; flex-direction: column;
  }
  .lw-lessonnav__header-block {
    padding: 20px 20px 16px; border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface-2, rgba(0,0,0,0.02)) 50%, var(--surface));
  }
  .lw-lessonnav__head {
    font-family: var(--font-body, system-ui); font-weight: 700; font-size: 1.05rem;
    color: var(--ink); letter-spacing: -0.01em; margin-bottom: 8px;
  }
  .lw-lessonnav__progress {
    display: flex; flex-direction: column; gap: 6px; margin-top: 4px;
  }
  .lw-lessonnav__progress-text {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 0.78rem; font-weight: 600; color: var(--ink-soft);
  }
  .lw-lessonnav__progressbar {
    width: 100%; height: 6px; border-radius: 9999px;
    background: color-mix(in srgb, var(--line) 60%, transparent);
    overflow: hidden;
  }
  .lw-lessonnav__progressfill {
    height: 100%; border-radius: 9999px;
    background: linear-gradient(90deg, var(--accent-2), var(--accent));
    transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lw-lessonnav__seqhint {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; color: var(--ink-soft); padding: 9px 20px;
    border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--accent) 5%, var(--surface));
  }
  .lw-lessonnav__units { display: flex; flex-direction: column; }
  .lw-lessonnav__unit { border-bottom: 1px solid var(--line); }
  .lw-lessonnav__unithead {
    width: 100%; display: flex; align-items: center; gap: 10px; text-align: start;
    background: transparent; border: none; cursor: pointer; padding: 13px 18px;
    font-family: var(--font-body); color: var(--ink); transition: background 0.15s ease;
  }
  .lw-lessonnav__unithead:hover { background: var(--surface-2, rgba(0,0,0,0.04)); }
  .lw-lessonnav__chevron { flex-shrink: 0; color: var(--ink-soft); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
  .lw-lessonnav__chevron.is-open { transform: rotate(180deg); color: var(--accent); }
  .lw-lessonnav__unittitle { flex: 1; font-weight: 600; font-size: 0.88rem; line-height: 1.35; color: var(--ink); }
  .lw-lessonnav__unitnum { font-weight: 700; color: var(--accent); margin-inline-end: 2px; }
  .lw-lessonnav__unitmeta { font-family: var(--font-mono, monospace); font-size: 11px; color: var(--ink-soft); white-space: nowrap; }
  .lw-lessonnav__unitdonebadge {
    display: inline-flex; align-items: center; gap: 3px;
    color: var(--success, #1E7D61); font-weight: 600;
  }
  .lw-lessonnav__lessons { display: flex; flex-direction: column; background: var(--bg); }
  .lw-lessonnav__lessonrow {
    display: flex; align-items: center; gap: 10px; width: 100%; text-align: start;
    background: transparent; border: none; border-top: 1px solid var(--line); cursor: pointer;
    padding: 11px 18px 11px 28px; font-family: var(--font-body); color: var(--ink);
    transition: all 0.15s ease; position: relative;
  }
  .lw-lessonnav__lessonrow:hover:not(.is-locked) {
    background: color-mix(in srgb, var(--accent) 4%, var(--surface));
  }
  .lw-lessonnav__lessonrow.is-active {
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    font-weight: 600; cursor: default;
  }
  .lw-lessonnav__lessonrow.is-active::before {
    content: ""; position: absolute; top: 0; bottom: 0; inset-inline-start: 0; width: 3px;
    background: var(--accent); border-radius: 0 2px 2px 0;
  }
  .lw-lessonnav__iconwrap {
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .lw-lessonnav__lessonrow svg { flex-shrink: 0; color: var(--ink-soft); }
  .lw-lessonnav__lessonrow svg.is-done { color: var(--success, #1E7D61); }
  .lw-lessonnav__lessonrow svg.is-active { color: var(--accent); }
  .lw-lessonnav__lessonrow svg.is-ready { color: var(--ink-soft); }
  .lw-lessonnav__lessonrow.is-locked { cursor: not-allowed; opacity: 0.5; }
  .lw-lessonnav__lessontitle { flex: 1; font-size: 0.84rem; line-height: 1.4; color: var(--ink); }
  .lw-lessonnav__lessonrow.is-active .lw-lessonnav__lessontitle { color: var(--accent); }
  .lw-lessonnav__lessonmins { font-family: var(--font-mono, monospace); font-size: 10.5px; color: var(--ink-soft); }

  .lw-btn { font-family: var(--font-body); font-weight: 600; font-size: 0.85rem; border-radius: var(--radius-sm); padding: 10px 16px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: transform .12s, box-shadow .12s; }
  .lw-btn:hover { transform: translateY(-1px); }
  .lw-btn--accent { background: var(--accent); border-color: var(--accent); color: var(--on-accent, #fff); }
  .lw-btn--ghost { background: transparent; }
  .lw-btn--sm { padding: 6px 12px; font-size: 0.78rem; }
  .lw-btn--lg { padding: 14px 24px; font-size: 0.95rem; margin-top: 24px; }

  .lw-greeting { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 30px; flex-wrap: wrap; }
  .lw-greeting p { color: var(--ink-soft); font-size: 0.9rem; max-width: 48ch; }

  .lw-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .lw-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @media (max-width: 900px) { .lw-grid3, .lw-grid2 { grid-template-columns: 1fr; } }

  /* .lw-card itself is not currently rendered by any screen — every screen
     defines its own scoped card class instead (.lw-learn__card,
     .lw-studio__card, .lw-lh__card, .lw-bill__entcard, and others). The
     notebook theme's dog-eared corner is added to those real classes
     directly, per screen — see e.g. LearnerHomeScreen.jsx, SubscriptionScreen.jsx.
     This base rule is left as found, in case something adopts it later. */
  .lw-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; position: relative; }
  .lw-card__eyebrow { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); margin-bottom: 10px; }
  .lw-card__title { font-family: var(--font-display); font-weight: 600; font-size: 1.1rem; margin-bottom: 4px; }
  .lw-card__meta { font-size: 0.8rem; color: var(--ink-soft); }
  .lw-stat { font-family: var(--font-display); font-size: 1.7rem; font-weight: 600; }
  .lw-coursecard { cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .lw-coursecard .lw-cover { margin: -20px -20px 0; width: calc(100% + 40px) !important; border-radius: var(--radius) var(--radius) 0 0; }
  .lw-coursecard:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.07); }

  [data-academy="lumen"] .lw-stampcard::after {
    content: "IN\\A PROGRESS"; white-space: pre; text-align: center; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.04em;
    position: absolute; top: 14px; inset-inline-end: 14px; width: 44px; height: 44px; border-radius: 50%;
    border: 1.5px dashed var(--accent); color: var(--accent); display: flex; align-items: center; justify-content: center; transform: rotate(8deg);
  }

  .lw-meter { display: flex; gap: 4px; margin: 8px 0; }
  .lw-meter span { width: 8px; height: 22px; background: var(--surface-2); border-radius: 2px; }
  .lw-meter span.filled { background: var(--accent-2); }
  .lw-progressbar { height: 6px; background: var(--surface-2); border-radius: 4px; margin: 10px 0 6px; overflow: hidden; }
  .lw-progressbar span { display: block; height: 100%; background: var(--accent-2); border-radius: 4px; }

  .lw-list { display: flex; flex-direction: column; gap: 8px; }
  .lw-listrow { display: flex; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 13px 16px; }
  .lw-listrow--new { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
  .lw-listrow--dim { opacity: 0.55; }
  .lw-tag--warn { background: #F0C040; color: #4A3A00; }
  .lw-tag--off { background: var(--line); color: var(--ink-soft); }
  .lw-eventlog { display: flex; flex-direction: column; gap: 5px; }
  .lw-eventlog__item { display: flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent-2); background: var(--surface-2); padding: 7px 12px; border-radius: var(--radius-sm); animation: lwFade .25s ease; }

  .lw-table__row--click { cursor: pointer; transition: background .12s; }
  .lw-table__row--click:hover { background: var(--surface-2); }

  .lw-aicard {
    display: flex; gap: 10px; align-items: flex-start;
    background: var(--callout-bg, color-mix(in srgb, var(--accent) 8%, var(--surface-2)));
    border: 1px solid var(--callout-line, color-mix(in srgb, var(--accent) 30%, var(--line)));
    border-radius: var(--radius-sm); padding: 12px 14px; margin: 14px 0; font-size: 0.85rem; color: var(--ink-soft);
  }
  .lw-aicard svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
  /* Sticky-note tilt — Student side only. The Tutor's ledger notes stay flat
     and formal; a tilted note reads as playful, which fits the composition
     notebook and not the leather ledger. */
  .lw-root--learner .lw-aicard { transform: rotate(-0.6deg); }
  .lw-aicard__body { flex: 1; }
  .lw-aicard__actions { display: flex; gap: 6px; flex-shrink: 0; }
  .lw-aicard__dismiss {
    background: transparent; border: none; color: var(--ink-soft); cursor: pointer;
    flex-shrink: 0; padding: 2px; border-radius: 6px; display: flex;
  }
  .lw-aicard__dismiss:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }

  /* NOTICE — the shared "state of the page" / "before you do this" callout
     (see components/Notice.jsx). Three tones, one visual identity each,
     replacing what used to be a byte-identical *__readonly/*__empty rule
     redefined separately on every screen. */
  .lw-notice--readonly { font-size: 0.83rem; color: var(--ink-soft); font-style: italic; margin-top: 16px; }
  .lw-notice--empty {
    text-align: center; color: var(--ink-soft);
    background: var(--surface); border: 1px dashed var(--line);
    border-radius: var(--radius-sm); padding: 40px 26px;
  }
  .lw-notice--empty h2 { font-family: var(--font-display); font-size: 1.1rem; color: var(--ink); margin: 12px 0 8px; }
  .lw-notice--empty p { font-size: 0.88rem; max-width: 46ch; margin: 0 auto; line-height: 1.6; }
  .lw-notice--empty.lw-notice--row {
    display: flex; gap: 16px; align-items: flex-start; text-align: start; max-width: 62ch;
  }
  .lw-notice__iconchip {
    width: 42px; height: 42px; border-radius: var(--radius-sm); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-notice--row .lw-notice__body p { font-size: 0.95rem; margin: 0 0 10px; line-height: 1.6; }
  .lw-notice--row .lw-notice__body p:last-of-type { margin-bottom: 16px; }
  .lw-notice--warning {
    display: flex; align-items: flex-start; gap: 8px;
    background: color-mix(in srgb, #E0912E 12%, transparent);
    border: 1px solid color-mix(in srgb, #E0912E 35%, transparent);
    color: #E0912E; border-radius: var(--radius-sm); padding: 9px 12px;
    font-size: 0.8rem; line-height: 1.5;
  }
  .lw-notice--warning svg { flex-shrink: 0; margin-top: 1px; }
  .lw-notice--warning .lw-notice__body { flex: 1; }

  .lw-unitlist { display: flex; flex-direction: column; gap: 14px; }
  .lw-unitcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
  .lw-unitcard__head { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 600; font-size: 1rem; margin-bottom: 10px; }
  .lw-unitcard__remove { margin-inline-start: auto; background: transparent; border: none; color: var(--ink-soft); cursor: pointer; }

  .lw-inlineai { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 0.75rem; cursor: pointer; margin-inline-start: 8px; font-weight: 600; }
  .lw-imagepicker { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .lw-imagepicker .lw-inlineai { margin-inline-start: 0; }
  .lw-inlineai:disabled { opacity: 0.4; cursor: default; }
  .lw-inlineinput { padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: var(--font-body); background: var(--surface); font-size: 0.85rem; }
  .lw-rationale { display: flex; align-items: center; gap: 5px; font-size: 0.74rem; color: var(--accent-2); margin-top: 3px; font-style: italic; }
  .lw-rowactions__single { background: transparent; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; }
  .lw-listrow__icon { width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent); font-size: 0.8rem; font-weight: 600; }
  .lw-listrow__body { flex: 1; }
  .lw-listrow__title { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; }
  .lw-listrow__meta { font-size: 0.78rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-tag { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; background: var(--surface-2); padding: 2px 7px; border-radius: 20px; color: var(--ink-soft); }
  .lw-tag--new { background: var(--accent); color: var(--on-accent, #fff); }
  /* Competency-Based Learning — Design Proposal §4: Mastered/Proficient read as success, Developing as caution, NotYet as attention-needed. */
  .lw-tag--competency-mastered { background: color-mix(in srgb, var(--accent-2) 18%, var(--surface-2)); color: var(--accent-2); }
  .lw-tag--competency-proficient { background: color-mix(in srgb, var(--accent) 18%, var(--surface-2)); color: var(--accent); }
  .lw-tag--competency-developing { background: #F0C040; color: #4A3A00; }
  .lw-tag--competency-notyet { background: color-mix(in srgb, var(--danger) 15%, var(--surface-2)); color: var(--danger); }
  .lw-timestamp { font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); background: var(--surface-2); }
  .lw-scorepill { font-family: var(--font-mono); font-weight: 600; font-size: 0.85rem; background: var(--surface-2); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--accent-2); }

  .lw-player { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; margin-bottom: 20px; }
  .lw-player__frame { background: linear-gradient(135deg, var(--ink), var(--accent-2)); color: var(--on-accent-2, #fff); height: 210px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; font-size: 0.85rem; opacity: 0.95; }
  .lw-videoplayer__youtube iframe { position: absolute; inset: 0; width: 100% !important; height: 100% !important; border: 0; }
  .lw-timeline { display: flex; gap: 18px; padding: 14px 18px; flex-wrap: wrap; border-top: 1px solid var(--line); }
  .lw-timeline__event { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--ink-soft); }
  .lw-timeline__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
  .lw-timeline__time { font-family: var(--font-mono); color: var(--ink); }

  .lw-questioncard__prompt { font-family: var(--font-display); font-size: 1.1rem; font-weight: 500; margin: 6px 0 16px; }
  .lw-options { display: flex; flex-direction: column; gap: 8px; }
  .lw-option { display: flex; justify-content: space-between; align-items: center; text-align: start; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); cursor: pointer; font-family: var(--font-body); font-size: 0.9rem; transition: all .12s; }
  .lw-option:hover:not(:disabled) { border-color: var(--accent); }
  .lw-option.is-correct { border-color: var(--accent-2); background: color-mix(in srgb, var(--accent-2) 10%, var(--bg)); color: var(--accent-2); font-weight: 600; }
  .lw-option.is-wrong { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, var(--bg)); color: var(--danger); }
  .lw-feedback { display: flex; gap: 8px; align-items: flex-start; margin-top: 16px; padding: 12px 14px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 0.85rem; }

  .lw-chat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .lw-bubble { max-width: 70%; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.88rem; display: flex; gap: 8px; align-items: flex-start; }
  .lw-bubble--ai { background: var(--surface-2); align-self: flex-start; }
  .lw-bubble--user { background: var(--accent); color: var(--on-accent, #fff); align-self: flex-end; }
  .lw-bubble__avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--accent-2); color: var(--on-accent-2, #fff); font-size: 0.7rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .lw-chatinput, .lw-composer { display: flex; gap: 8px; margin-top: 8px; }
  .lw-chatinput input, .lw-composer input { flex: 1; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: var(--font-body); background: var(--bg); }
  .lw-composer { margin-bottom: 16px; }

  .lw-dropzone { border: 2px dashed var(--line); border-radius: var(--radius); padding: 44px; text-align: center; color: var(--ink-soft); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: border-color .15s; background: var(--surface); }
  .lw-dropzone:hover { border-color: var(--accent); }
  .lw-dropzone__title { font-weight: 600; color: var(--ink); font-family: var(--font-body); }
  .lw-dropzone__meta { font-size: 0.78rem; }
  .lw-dropzone--compact { padding: 20px; margin-bottom: 4px; }
  .lw-videosource { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
  .lw-tag--source { background: color-mix(in srgb, var(--accent) 15%, var(--surface-2)); color: var(--accent); margin-inline-start: 6px; }

  .lw-transcriptpanel { display: flex; flex-direction: column; gap: 12px; }
  .lw-transcriptbox { width: 100%; font-family: var(--font-mono, monospace); font-size: 13px; resize: vertical; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px 10px; background: var(--surface); color: var(--ink); }

  .lw-transcriptready { display: flex; flex-direction: column; gap: 8px; }
  .lw-transcriptready__row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .lw-transcriptready__title { font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
  .lw-transcriptready__check { color: var(--accent-2, var(--accent)); }
  .lw-transcriptready__meta { font-weight: normal; font-size: 0.75rem; }
  .lw-transcriptready__actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .lw-transcriptready__confirm { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .lw-transcriptcreate { display: flex; flex-direction: column; gap: 10px; }
  .lw-transcriptcreate__warning { font-size: 0.78rem; margin: 0; }
  .lw-transcriptcreate__row { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
  .lw-transcriptcreate__lang { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; }
  .lw-transcriptcreate__lang select { font-size: 0.82rem; padding: 6px 8px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface); color: var(--ink); }

  .lw-transcriptcards { display: flex; gap: 10px; flex-wrap: wrap; }
  .lw-transcriptcard {
    flex: 1 1 220px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: start;
    padding: 12px 14px; border: 1.5px solid var(--line); border-radius: var(--radius-sm); background: var(--surface);
    color: var(--ink); cursor: pointer; font-family: var(--font-body); transition: border-color .12s, background-color .12s;
  }
  .lw-transcriptcard:hover:not(:disabled) { border-color: var(--accent); }
  .lw-transcriptcard--selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
  .lw-transcriptcard:disabled { opacity: 0.6; cursor: default; }
  .lw-transcriptcard__icon { color: var(--accent); }
  .lw-transcriptcard__title { font-weight: 600; font-size: 0.85rem; }
  .lw-transcriptcard__hint { font-size: 0.76rem; color: var(--ink-soft); }
  .lw-transcriptcard__cost { font-size: 0.72rem; color: var(--ink-soft); margin-top: 2px; }
  @media (max-width: 520px) { .lw-transcriptcards { flex-direction: column; } .lw-transcriptcard { flex: 1 1 auto; } }

  .lw-principle { display: flex; gap: 10px; align-items: flex-start; background: var(--surface-2); border-radius: var(--radius-sm); padding: 13px 16px; font-size: 0.85rem; color: var(--ink-soft); margin-top: 20px; }
  .lw-principle strong { color: var(--ink); }

  .lw-analyzing { display: flex; gap: 20px; align-items: center; }
  .lw-analyzing__steps { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; }
  .lw-analyzing__steps li { display: flex; align-items: center; gap: 8px; color: var(--ink-soft); }
  .lw-analyzing__steps li.done { color: var(--accent-2); }
  .lw-analyzing__steps li.active { color: var(--accent); font-weight: 600; }

  .lw-spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--surface-2); border-top-color: var(--accent); animation: lwSpin .8s linear infinite; flex-shrink: 0; }
  @keyframes lwSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-spinner { animation-duration: 2.4s; } }

  .lw-stepper { display: flex; gap: 6px; margin-bottom: 22px; flex-wrap: wrap; }
  .lw-stepper__item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--ink-soft); padding: 5px 10px; border-radius: 20px; background: var(--surface-2); }
  .lw-stepper__item span { width: 16px; height: 16px; border-radius: 50%; background: var(--line); color: var(--ink-soft); font-size: 10px; display: flex; align-items: center; justify-content: center; }
  .lw-stepper__item.done { color: var(--accent-2); }
  .lw-stepper__item.done span { background: var(--accent-2); color: var(--on-accent-2, #fff); }
  .lw-stepper__item.active { color: var(--accent); font-weight: 600; background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }
  .lw-stepper__item.active span { background: var(--accent); color: var(--on-accent, #fff); }

  .lw-titleinput { font-family: var(--font-display); font-weight: 600; font-size: 2rem; border: none; border-bottom: 2px dashed var(--line); background: transparent; width: 100%; padding: 4px 0; color: var(--ink); }
  .lw-titleinput:focus { outline: none; border-color: var(--accent); }
  .lw-objectives { margin: 4px 0 0; padding-inline-start: 20px; font-size: 0.9rem; color: var(--ink-soft); display: flex; flex-direction: column; gap: 6px; }
  .lw-questionrow.accepted { border-color: var(--accent-2); }
  .lw-questionrow.removed { opacity: 0.5; }
  .lw-rowactions { display: flex; gap: 4px; }
  .lw-rowactions button { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
  .lw-rowactions button:hover { color: var(--ink); }
  .lw-rowactions button.active { background: var(--accent-2); border-color: var(--accent-2); color: var(--on-accent-2, #fff); }
  .lw-rowactions button.active.danger { background: var(--danger); border-color: var(--danger); }
  .lw-empty { color: var(--ink-soft); font-size: 0.88rem; padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius); }

  .lw-table { border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
  .lw-table__row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 12px 16px; font-size: 0.86rem; background: var(--surface); border-bottom: 1px solid var(--line); }
  .lw-table__row:last-child { border-bottom: none; }
  .lw-table__row--head { background: var(--surface-2); font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); }

  .lw-badgegrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .lw-badge { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px 14px; text-align: center; color: var(--ink-soft); display: flex; flex-direction: column; align-items: center; gap: 6px; opacity: 0.6; }
  .lw-badge.is-earned { opacity: 1; color: var(--ink); border-color: var(--accent-2); }
  .lw-badge.is-earned svg { color: var(--accent-2); }
  .lw-badge__name { font-weight: 600; font-size: 0.85rem; }
  .lw-badge__meta { font-size: 0.72rem; }

  .lw-settingsrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); }
  .lw-settingsrow:first-of-type { border-top: none; }
  .lw-settingsrow label { font-size: 0.82rem; color: var(--ink-soft); flex-shrink: 0; }
  .lw-settingsrow input { text-align: end; border: none; background: transparent; font-family: var(--font-body); font-size: 0.85rem; color: var(--ink); width: 60%; }
  .lw-settingsrow input:focus { outline: none; }
  .lw-swatchrow { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
  .lw-swatch { display: flex; gap: 8px; align-items: center; font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-soft); }
  .lw-swatch span { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--line); flex-shrink: 0; }

  .lw-widgetrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
  .lw-widgetrow:first-of-type { border-top: none; }
  .lw-widgetrow__label { font-size: 0.88rem; font-weight: 600; }
  .lw-widgetrow__consequence { font-size: 0.76rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-toggle { width: 40px; height: 22px; border-radius: 20px; background: var(--line); border: none; cursor: pointer; position: relative; flex-shrink: 0; transition: background .15s; }
  .lw-toggle span { position: absolute; top: 2px; inset-inline-start: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: inset-inline-start .15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .lw-toggle.is-on { background: var(--accent-2); }
  .lw-toggle.is-on span { inset-inline-start: 20px; }

  .lw-overlay { position: fixed; inset: 0; background: rgba(10,12,15,0.55); display: flex; align-items: flex-start; justify-content: center; padding: 40px 20px; z-index: 50; overflow-y: auto; animation: lwFade .2s ease; }
  .lw-overlay__panel { background: #FAFAFA; color: #222; border-radius: 16px; max-width: 640px; width: 100%; padding: 32px 36px 40px; position: relative; font-family: 'IBM Plex Sans', sans-serif; }
  .lw-overlay__panel--wizard { max-width: 620px; }

  .lw-wizardsteps { display: flex; gap: 6px; margin: 18px 0 24px; flex-wrap: wrap; }
  .lw-wizardsteps__item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #999; padding: 5px 10px; border-radius: 20px; background: #EFEFEC; }
  .lw-wizardsteps__item span { width: 16px; height: 16px; border-radius: 50%; background: #DDD; color: #999; font-size: 10px; display: flex; align-items: center; justify-content: center; }
  .lw-wizardsteps__item.done { color: #1E8E63; }
  .lw-wizardsteps__item.done span { background: #1E8E63; color: #fff; }
  .lw-wizardsteps__item.active { color: #2454C7; font-weight: 600; background: #E6ECFB; }
  .lw-wizardsteps__item.active span { background: #2454C7; color: #fff; }

  .lw-wizardbody { display: flex; flex-direction: column; gap: 14px; }
  .lw-wfield { display: flex; flex-direction: column; gap: 6px; }
  .lw-wfield label { font-size: 0.8rem; font-weight: 600; color: #444; display: flex; align-items: center; gap: 6px; }
  .lw-wfield input { padding: 10px 13px; border-radius: 8px; border: 1px solid #DDD; font-family: 'IBM Plex Sans', sans-serif; font-size: 0.9rem; background: #fff; }
  .lw-wfield input:focus { outline: 2px solid #2454C7; outline-offset: 1px; }

  .lw-segctrl { display: flex; gap: 6px; flex-wrap: wrap; }
  .lw-segctrl button { padding: 7px 14px; border-radius: 20px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 0.82rem; cursor: pointer; }
  .lw-segctrl button.active { background: var(--accent); border-color: var(--accent); color: var(--on-accent, #fff); }

  .lw-presetgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .lw-presetcard { border: 2px solid #E3E3E3; border-radius: 12px; padding: 14px; cursor: pointer; background: #fff; transition: border-color .12s; }
  .lw-presetcard.is-selected { border-color: #2454C7; }
  .lw-presetcard__swatches { display: flex; gap: 4px; margin-bottom: 10px; }
  .lw-presetcard__swatches span { width: 20px; height: 20px; border-radius: 5px; border: 1px solid rgba(0,0,0,0.08); }
  .lw-presetcard__label { font-weight: 600; font-size: 0.86rem; margin-bottom: 3px; }
  .lw-presetcard__desc { font-size: 0.74rem; color: #888; line-height: 1.35; }

  .lw-wizardnav { display: flex; justify-content: space-between; margin-top: 8px; }
  .lw-wizardsummary { display: flex; flex-direction: column; gap: 8px; background: #fff; border: 1px solid #E3E3E3; border-radius: 10px; padding: 14px 16px; font-size: 0.85rem; }
  .lw-wizardsummary div { display: flex; justify-content: space-between; gap: 12px; }
  .lw-wizardsummary span { color: #999; }
  .lw-eventtrace { display: flex; flex-direction: column; gap: 7px; margin: 16px 0; font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; }
  .lw-eventtrace__item { display: flex; align-items: center; gap: 8px; color: #AAA; transition: color .2s; }
  .lw-eventtrace__item.done { color: #1E8E63; }
  .lw-overlay__panel .lw-listrow, .lw-overlay__panel .lw-badge { background: #fff; border-color: #E3E3E3; }
  .lw-overlay__panel .lw-badge.is-earned { border-color: #1E8E63; }
  .lw-overlay__panel h1 { color: #1A1A1A; }
  .lw-overlay__close { position: absolute; top: 20px; inset-inline-end: 20px; background: transparent; border: none; cursor: pointer; color: #888; }
  .lw-idcard { display: flex; gap: 14px; align-items: center; background: #fff; border: 1px solid #E3E3E3; border-radius: 12px; padding: 16px; margin-bottom: 6px; }
  .lw-idcard__avatar { width: 44px; height: 44px; border-radius: 50%; background: #2454C7; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
  .lw-idcard__name { font-weight: 600; }
  .lw-idcard__meta { font-size: 0.8rem; color: #777; }

  button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  ${LANGUAGE_TOGGLE_CSS}
  ${THEME_TOGGLE_CSS}
  ${MODAL_CSS}

  /* ── Shared form field (entry screens; available everywhere) ─────────── */
  .lw-field { display: flex; flex-direction: column; gap: 6px; text-align: start; }
  .lw-field__label { font-size: 0.8rem; font-weight: 600; color: var(--ink); }
  .lw-field__hint { font-size: 0.76rem; color: var(--ink-soft); line-height: 1.45; }
  .lw-field input, .lw-field textarea, .lw-field select {
    font-family: var(--font-body); font-size: 0.95rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 10px 12px; width: 100%; resize: vertical;
  }
  .lw-field input:focus-visible, .lw-field textarea:focus-visible, .lw-field select:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent);
  }
  .lw-field input[aria-invalid="true"] { border-color: var(--danger); }
  .lw-field__error { font-size: 0.78rem; color: var(--danger); }

  /* ── Entry screens (components/EntryShell.jsx) ───────────────────────── */
  .lw-entry { background-image: var(--page-texture, none); }
  .lw-entry__bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 16px 24px; }
  .lw-entry__brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
  .lw-entry__brandmark {
    width: 30px; height: 30px; border-radius: var(--radius-sm); display: grid; place-items: center;
    background: var(--accent); color: var(--on-accent, #fff); font-family: var(--font-display); font-weight: 800;
  }
  .lw-entry__brandname { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; letter-spacing: -0.01em; }
  .lw-entry__controls { display: flex; align-items: center; gap: 8px; }
  .lw-entry__main { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 32px 16px 56px; }
  .lw-entry__main > * { width: 100%; max-width: 460px; }
  .lw-entry__main--wide > * { max-width: 980px; }
  @media (min-height: 760px) { .lw-entry__main:not(.lw-entry__main--wide) { align-items: center; padding-top: 0; } }
  .lw-entry__card { padding: 32px 28px; }
  .lw-entry__card--center { text-align: center; }
  .lw-entry__card--start { text-align: start; }
  .lw-entry__card .lw-eyebrow { text-align: inherit; }
  .lw-entry__mark {
    width: 48px; height: 48px; border-radius: var(--radius); margin: 0 auto 16px;
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--accent) 14%, var(--surface)); color: var(--accent);
  }
  .lw-entry__card--start .lw-entry__mark { margin-inline: 0; }
  .lw-entry__mark--good { background: color-mix(in srgb, var(--success) 14%, var(--surface)); color: var(--success); }
  .lw-entry__mark--bad { background: color-mix(in srgb, var(--danger) 14%, var(--surface)); color: var(--danger); }
  .lw-entry__mark--muted { background: var(--surface-2); color: var(--ink-soft); }
  .lw-entry__title { font-family: var(--font-display); font-size: 1.5rem; margin: 0 0 10px; text-align: inherit; }
  .lw-entry__lead { color: var(--ink-soft); font-size: 0.95rem; line-height: 1.6; margin: 0; }
  .lw-entry__lead + .lw-entry__lead { margin-top: 10px; }
  .lw-entry__form { display: flex; flex-direction: column; gap: 14px; margin-top: 22px; text-align: start; }
  .lw-entry__actions { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
  .lw-entry__actions .lw-btn, .lw-entry__form .lw-btn--accent { justify-content: center; width: 100%; }
  .lw-entry__row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 0.85rem; }
  .lw-entry__link {
    background: none; border: 0; padding: 0; font: inherit; font-size: 0.85rem; cursor: pointer;
    color: var(--accent); text-decoration: underline; text-underline-offset: 2px;
  }
  .lw-entry__note { font-size: 0.82rem; color: var(--ink-soft); line-height: 1.5; margin: 16px 0 0; }
  .lw-entry__alert {
    display: flex; gap: 10px; align-items: flex-start; text-align: start; margin-top: 18px;
    padding: 12px 14px; border-radius: var(--radius-sm); font-size: 0.87rem; line-height: 1.5;
    border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
    background: color-mix(in srgb, var(--danger) 10%, var(--surface)); color: var(--ink);
  }
  .lw-entry__alert--good {
    border-color: color-mix(in srgb, var(--success) 35%, transparent);
    background: color-mix(in srgb, var(--success) 10%, var(--surface));
  }
  .lw-entry__alert svg { flex-shrink: 0; margin-top: 2px; }
  .lw-entry__alert--bad svg { color: var(--danger); }
  .lw-entry__alert--good svg { color: var(--success); }
  .lw-entry__code {
    display: block; margin-top: 10px; padding: 10px 12px; border-radius: var(--radius-sm);
    background: var(--surface-2); font-family: var(--font-mono); font-size: 0.8rem; word-break: break-all; text-align: start;
  }
  .lw-entry__facts { display: flex; justify-content: center; gap: 22px; flex-wrap: wrap; margin: 24px 0 0; padding-top: 18px; border-top: 1px solid var(--line); }
  .lw-entry__facts div { text-align: start; }
  .lw-entry__facts dt { font-size: 0.72rem; font-weight: 600; color: var(--ink-soft); margin-bottom: 3px; }
  .lw-entry__facts dd { margin: 0; font-size: 0.88rem; }
  .lw-entry__spin { animation: lwEntrySpin 0.9s linear infinite; color: var(--accent); }
  @keyframes lwEntrySpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-entry__spin { animation: none; } }
  @media (max-width: 520px) { .lw-entry__bar { padding: 12px 16px; } .lw-entry__card { padding: 26px 20px; } }
  .lw-field__control { position: relative; display: block; }
  .lw-field__control input { padding-inline-end: 42px; }
  .lw-field__reveal {
    position: absolute; inset-inline-end: 6px; top: 50%; transform: translateY(-50%);
    background: none; border: 0; padding: 6px; cursor: pointer; color: var(--ink-soft); display: flex;
  }
  [dir="rtl"] .lw-flip { transform: scaleX(-1); }
  .lw-entry__steps { margin-top: 26px; padding-top: 18px; border-top: 1px solid var(--line); text-align: start; }
  .lw-entry__steps h2 { font-size: 0.95rem; margin: 0 0 10px; }
  .lw-entry__steps ol { margin: 0; padding-inline-start: 20px; color: var(--ink-soft); font-size: 0.88rem; line-height: 1.6; }
  .lw-wslist { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .lw-wslist__head { font-size: 0.85rem; color: var(--ink-soft); margin: 24px 0 0; font-weight: 600; }
  .lw-wscard {
    width: 100%; display: flex; align-items: center; gap: 14px; text-align: start; cursor: pointer;
    padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--ink);
    font: inherit; transition: border-color .12s, transform .12s;
  }
  button.lw-wscard:hover { border-color: var(--accent); transform: translateY(-1px); }
  .lw-wscard.is-blocked { cursor: default; background: var(--surface-2); }
  .lw-wscard__mark {
    width: 40px; height: 40px; flex-shrink: 0; border-radius: var(--radius-sm); display: grid; place-items: center;
    background: color-mix(in srgb, var(--accent) 14%, var(--surface)); color: var(--accent); font-weight: 700; font-size: 1.1rem;
  }
  .lw-wscard.is-other .lw-wscard__mark, .lw-wscard.is-blocked .lw-wscard__mark { background: var(--surface-2); color: var(--ink-soft); }
  .lw-wscard__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .lw-wscard__name { font-weight: 600; }
  .lw-wscard__note { font-size: 0.8rem; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .lw-wscard__go { color: var(--ink-soft); flex-shrink: 0; }
  .lw-entry__empty { text-align: center; padding: 24px 8px 4px; color: var(--ink-soft); display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .lw-entry__empty h2 { color: var(--ink); font-size: 1.05rem; margin: 4px 0 0; }
  .lw-entry__empty p { margin: 0 0 6px; line-height: 1.55; }

  /* Arabic: letter-spacing breaks letter joining and the mono font has no Arabic glyphs,
     so small-caps-style labels switch to the body font with normal spacing. */
  :lang(ar) .lw-eyebrow, :lang(ar) .lw-card__eyebrow { font-family: var(--font-body); letter-spacing: 0; text-transform: none; font-size: 12.5px; font-weight: 600; }

  .lw-entry__link--end { align-self: flex-end; }
  .lw-entry__back { margin-top: 18px; }
  .lw-entry__note--top { margin: 0 0 6px; }

  /* ── Landing page (screens/LandingScreen.jsx) ─────────────────────────── */
  .lw-land { display: flex; flex-direction: column; gap: 48px; }
  .lw-land__hero { text-align: center; display: flex; flex-direction: column; align-items: center; padding-top: 24px; }
  .lw-land__title { font-family: var(--font-display); font-size: clamp(2rem, 5vw, 3.1rem); line-height: 1.15; margin: 6px 0 18px; }
  .lw-land__accent { color: var(--accent); }
  .lw-land__claims { display: grid; min-height: 1.6em; margin-bottom: 8px; color: var(--ink-soft); font-size: 1.05rem; }
  .lw-land__claim { grid-area: 1 / 1; opacity: 0; transition: opacity .4s ease; }
  .lw-land__claim.is-active { opacity: 1; }
  .lw-land__claim.is-ghost { visibility: hidden; }
  .lw-land__points { list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 22px; padding: 0; margin: 22px 0 0; color: var(--ink-soft); font-size: 0.9rem; }
  .lw-land__points li { display: inline-flex; align-items: center; gap: 6px; }
  .lw-land__points svg { color: var(--success); }
  .lw-land__plans { text-align: center; }
  .lw-land__plantitle { font-family: var(--font-display); font-size: 1.6rem; margin: 0 0 8px; }
  .lw-land__foot { text-align: center; color: var(--ink-soft); font-size: 0.82rem; padding-bottom: 8px; }

  .lw-prev { max-width: 760px; margin: 0 auto; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--surface); box-shadow: 0 18px 40px color-mix(in srgb, var(--ink) 12%, transparent); }
  .lw-prev__bar { display: flex; gap: 6px; padding: 10px 12px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
  .lw-prev__bar span { width: 9px; height: 9px; border-radius: 50%; background: var(--line); }
  .lw-prev__body { display: grid; grid-template-columns: 170px 1fr; min-height: 230px; }
  .lw-prev__side { background: var(--nav-bg); padding: 16px 14px; display: flex; flex-direction: column; gap: 8px; }
  .lw-prev__mark { width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--accent); margin-bottom: 6px; }
  .lw-prev__side .lw-prev__line { background: color-mix(in srgb, var(--nav-text) 30%, transparent); }
  .lw-prev__nav { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .lw-prev__nav span { height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--nav-text) 18%, transparent); }
  .lw-prev__nav span.is-active { background: var(--accent); }
  .lw-prev__main { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
  .lw-prev__line { height: 8px; border-radius: 4px; background: var(--surface-2); }
  .lw-prev__line.is-tall { height: 14px; }
  .is-w40 { width: 40%; } .is-w50 { width: 50%; } .is-w70 { width: 70%; }
  .lw-prev__cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .lw-prev__card { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px; display: flex; flex-direction: column; gap: 8px; }
  .lw-prev__cover { height: 54px; border-radius: 6px; background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .lw-prev__cover.is-c1 { background: color-mix(in srgb, var(--accent-2) 24%, var(--surface)); }
  .lw-prev__cover.is-c2 { background: color-mix(in srgb, var(--success) 22%, var(--surface)); }
  .lw-prev__progress { height: 5px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
  .lw-prev__progress i { display: block; height: 100%; background: var(--accent); }
  @media (max-width: 640px) { .lw-prev__body { grid-template-columns: 1fr; } .lw-prev__side { display: none; } .lw-prev__cards { grid-template-columns: 1fr 1fr; } }
  @media (prefers-reduced-motion: reduce) { .lw-land__claim { transition: none; } }
  .lw-prev__progress .is-p38 { width: 38%; } .lw-prev__progress .is-p64 { width: 64%; } .lw-prev__progress .is-p82 { width: 82%; }
  ${PLAN_PICKER_CARDS_CSS}
`;
