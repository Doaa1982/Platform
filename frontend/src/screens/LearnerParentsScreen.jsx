import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import { ParentContactList } from "../components/ParentContacts";
import { PARENT_CSS } from "../utils/parentContacts";

/* =========================================================================
   MY PARENTS (Learner) — who receives the academy's progress emails about
   me (Parent Progress Reports Business Analysis §6). A learner adds or
   removes their own parents only; each one confirms from their own email
   before anything is sent.
   ========================================================================= */

export default function LearnerParentsScreen() {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.getMyParentContacts(session.token, slug)
    .then((d) => { setData(d); setError(null); })
    .catch((e) => setError(e.message)), [session.token, slug]);

  useEffect(() => {
    let cancelled = false;
    api.getMyParentContacts(session.token, slug)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  async function run(fn, successMessage) {
    setBusy(true); setError(null); setSuccess(null);
    try { await fn(); setSuccess(successMessage); await load(); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }

  return (
    <div className="lw-page">
      <style>{PARENT_CSS + CSS}</style>
      <div className="lw-eyebrow">{t("learnerParents.eyebrow")}</div>
      <h1>{t("learnerParents.title")}</h1>
      <p className="lw-sub">{t("learnerParents.lead")}</p>
      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {!data ? (
        !error && <div className="lw-lparents__loading"><LoaderCircle size={18} className="lw-lparents__spin" /> {t("learnerParents.loading")}</div>
      ) : (
        <section className="lw-card lw-lparents__card">
          <ParentContactList
            mode="learner" contacts={data.contacts} max={data.maxPerLearner} busy={busy}
            onAdd={(p) => run(() => api.addMyParentContact(session.token, slug, p), t("parents.toastAdded", { email: p.email }))}
            onRemove={(c) => run(() => api.removeMyParentContact(session.token, slug, c.id), t("parents.toastRemoved", { name: c.name }))}
          />
        </section>
      )}
    </div>
  );
}

const CSS = `
  .lw-lparents__card { max-width: 720px; margin: 0 auto; padding: 20px 22px; }
  .lw-lparents__loading { display: flex; align-items: center; justify-content: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-lparents__spin { animation: lwLParentsSpin 0.9s linear infinite; }
  @keyframes lwLParentsSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-lparents__spin { animation: none; } }
`;
