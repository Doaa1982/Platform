import { useState } from "react";
import { Mail, Pencil, Plus, RotateCcw, Trash2, MessageCircle } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import { EMPTY_PARENT, parentProblems, toParentRequest } from "../utils/parentContacts";

/* =========================================================================
   PARENT CONTACTS — the shared pieces behind the tutor's "Parents" area on
   the Members screen, the learner's "My parents" page and the invite form
   (Parent Progress Reports Business Analysis).

   A parent is a contact, not a user: name, email, the language their emails
   come in (Arabic unless chosen otherwise), and an optional WhatsApp number
   kept for later. Nothing is sent until they confirm from their email.
   ========================================================================= */

/** Name, email, language, WhatsApp — controlled. `showErrors` turns on the field messages. */
export function ParentFields({ value, onChange, disabled, idPrefix, showErrors = false }) {
  const { t } = useLanguage();
  const problems = showErrors ? parentProblems(value) : {};
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const id = (field) => `${idPrefix}-${field}`;
  // The message sits outside the <label> (so it isn't read as part of the field's name) and is
  // tied to the field with aria-describedby instead.
  const err = (field) => problems[field] && <small id={id(`${field}-err`)} className="lw-parent__err">{t(problems[field])}</small>;
  const described = (field) => (problems[field] ? id(`${field}-err`) : undefined);
  return (
    <div className="lw-parent__fields">
      <div className="lw-parent__field">
        <label htmlFor={id("name")}>{t("parents.name")}</label>
        <input id={id("name")} value={value.name} onChange={set("name")} disabled={disabled} autoComplete="off"
               aria-invalid={!!problems.name} aria-describedby={described("name")} dir="auto" />
        {err("name")}
      </div>
      <div className="lw-parent__field">
        <label htmlFor={id("email")}>{t("parents.email")}</label>
        <input id={id("email")} type="email" value={value.email} onChange={set("email")} disabled={disabled}
               autoComplete="off" aria-invalid={!!problems.email} aria-describedby={described("email")} dir="ltr" />
        {err("email")}
      </div>
      <div className="lw-parent__field">
        <label htmlFor={id("language")}>{t("parents.language")}</label>
        <select id={id("language")} value={value.language} onChange={set("language")} disabled={disabled}>
          <option value="ar">{t("parents.languageAr")}</option>
          <option value="en">{t("parents.languageEn")}</option>
        </select>
      </div>
      <div className="lw-parent__field">
        <label htmlFor={id("whatsapp")}>{t("parents.whatsapp")} <em className="lw-parent__optional">{t("parents.optional")}</em></label>
        <input id={id("whatsapp")} type="tel" value={value.whatsAppPhone} onChange={set("whatsAppPhone")} disabled={disabled}
               placeholder="+20 100 123 4567" aria-invalid={!!problems.whatsAppPhone} aria-describedby={described("whatsAppPhone")} dir="ltr" />
        {err("whatsAppPhone")}
      </div>
    </div>
  );
}

/** Add or edit one parent. */
export function ParentContactForm({ initial = EMPTY_PARENT, submitLabel, busy, onSubmit, onCancel, idPrefix = "parent" }) {
  const { t } = useLanguage();
  const [value, setValue] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  return (
    <form className="lw-parent__form" noValidate onSubmit={(e) => {
      e.preventDefault();
      setAttempted(true);
      if (Object.keys(parentProblems(value)).length > 0) return;
      onSubmit(toParentRequest(value));
    }}>
      <ParentFields value={value} onChange={setValue} disabled={busy} idPrefix={idPrefix} showErrors={attempted} />
      <p className="lw-parent__hint">{t("parents.consentHint")}</p>
      <div className="lw-parent__actions">
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}>{submitLabel}</button>
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onCancel}>{t("parents.cancel")}</button>
      </div>
    </form>
  );
}

const STATUS_KEY = { Waiting: "parents.statusWaiting", Confirmed: "parents.statusConfirmed", Unsubscribed: "parents.statusUnsubscribed", Expired: "parents.statusExpired" };

/**
 * One learner's parents, with what each viewer may do: the tutor adds, edits, resends and
 * removes; the learner adds and removes their own. Up to `max` (2).
 */
export function ParentContactList({ contacts, max = 2, mode = "tutor", busy, onAdd, onUpdate, onResend, onRemove }) {
  const { t } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const canChange = typeof onAdd === "function";

  return (
    <div className="lw-parent">
      {contacts.length === 0 && !adding && <p className="lw-parent__empty">{t(mode === "learner" ? "parents.emptyLearner" : "parents.empty")}</p>}

      {contacts.length > 0 && (
        <ul className="lw-parent__list">
          {contacts.map((c) => (
            <li key={c.id} className="lw-parent__item">
              {editingId === c.id ? (
                <ParentContactForm
                  idPrefix={`edit-${c.id}`}
                  initial={{ name: c.name, email: c.email, language: c.language, whatsAppPhone: c.whatsAppPhone ?? "" }}
                  submitLabel={t("parents.save")} busy={busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (p) => { if (await onUpdate(c, p)) setEditingId(null); }}
                />
              ) : (
                <>
                  <div className="lw-parent__who">
                    <span className="lw-parent__name" dir="auto">{c.name}</span>
                    <span className={`lw-parent__pill is-${c.status.toLowerCase()}`}>{t(STATUS_KEY[c.status] ?? "parents.statusWaiting")}</span>
                    <span className="lw-parent__meta">
                      <Mail size={12} aria-hidden="true" /> <span dir="ltr">{c.email}</span>
                      {" · "}{c.language === "en" ? t("parents.languageEn") : t("parents.languageAr")}
                      {c.whatsAppPhone && <> {" · "}<MessageCircle size={12} aria-hidden="true" /> <span dir="ltr">{c.whatsAppPhone}</span></>}
                    </span>
                    {c.status === "Expired" && <span className="lw-parent__note">{t("parents.expiredNote")}</span>}
                    {c.status === "Unsubscribed" && <span className="lw-parent__note">{t(mode === "learner" ? "parents.unsubscribedNoteLearner" : "parents.unsubscribedNote")}</span>}
                  </div>
                  {canChange && (
                    removingId === c.id ? (
                      <div className="lw-parent__confirm" role="group" aria-label={t("parents.removeConfirm", { name: c.name })}>
                        <span>{t("parents.removeConfirm", { name: c.name })}</span>
                        <button type="button" className="lw-btn lw-btn--accent lw-btn--xs" disabled={busy}
                                onClick={async () => { await onRemove(c); setRemovingId(null); }}>{t("parents.removeYes")}</button>
                        <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy}
                                onClick={() => setRemovingId(null)}>{t("parents.cancel")}</button>
                      </div>
                    ) : (
                      <div className="lw-parent__rowactions">
                        {mode === "tutor" && (
                          <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy} onClick={() => setEditingId(c.id)}>
                            <Pencil size={12} /> {t("parents.edit")}
                          </button>
                        )}
                        {mode === "tutor" && c.status !== "Confirmed" && (
                          <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy} onClick={() => onResend(c)}>
                            <RotateCcw size={12} /> {t("parents.resend")}
                          </button>
                        )}
                        <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy} onClick={() => setRemovingId(c.id)}>
                          <Trash2 size={12} /> {t("parents.remove")}
                        </button>
                      </div>
                    )
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canChange && (adding ? (
        <ParentContactForm idPrefix="new-parent" submitLabel={t("parents.add")} busy={busy}
                           onCancel={() => setAdding(false)}
                           onSubmit={async (p) => { if (await onAdd(p)) setAdding(false); }} />
      ) : contacts.length < max ? (
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm lw-parent__addbtn" disabled={busy} onClick={() => setAdding(true)}>
          <Plus size={13} /> {t("parents.addParent")}
        </button>
      ) : (
        <p className="lw-parent__hint">{t("parents.maxReached", { max })}</p>
      ))}
    </div>
  );
}
