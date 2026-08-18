import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, UserX, X } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   COURSE ENROLLMENT SCREEN — per-course roster management.

   The Members screen answers "who belongs to this workspace"; this screen
   answers "who's in this course" for one Learning Product at a time — the
   view a tutor reaches for once they need to undo an enrollment (refund,
   mistaken invite, seat swap) without touching the person's workspace
   Membership, or to chase up invitations that named a specific course and
   are still outstanding.
   ========================================================================= */

export default function CourseEnrollmentScreen() {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [roster, setRoster] = useState(null);
  const [tab, setTab] = useState("enrolled");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getProducts(session.token, slug)
      .then((r) => {
        if (cancelled) return;
        const list = r?.products ?? [];
        setProducts(list);
        setProductId((prev) => prev || list[0]?.id || "");
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  const loadRoster = useCallback(() => {
    if (!productId) return Promise.resolve();
    return api.getProductRoster(session.token, slug, productId)
      .then((r) => { setRoster(r); setError(null); })
      .catch((e) => setError(e.message));
  }, [session.token, slug, productId]);

  useEffect(() => { loadRoster(); }, [loadRoster]);
  // A roster fetched for a since-abandoned product selection is stale, not
  // ready — comparing rather than nulling the state on every switch keeps
  // this effect free of synchronous setState calls.
  const rosterReady = roster && roster.productId === productId;

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fn();
      if (successMessage) setSuccess(successMessage);
      await loadRoster();
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{t("enrollment.eyebrow")}</div>
      <h1>{t("enrollment.title")}</h1>
      <p className="lw-sub">{t("enrollment.lead")}</p>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      <div className="lw-enroll__picker">
        <span>{t("enrollment.courseLabel")}</span>
        {products.length === 0 ? (
          <span className="lw-enroll__nocourses">{t("enrollment.noCourses")}</span>
        ) : (
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        <button type="button" className="lw-enroll__refresh" onClick={loadRoster} disabled={busy || !productId} aria-label={t("members.refresh")}>
          <RefreshCw size={13} />
        </button>
      </div>

      {productId && !rosterReady && !error && (
        <div className="lw-enroll__loading"><LoaderCircle size={18} className="lw-enroll__spin" /> {t("members.loading")}</div>
      )}

      {rosterReady && (
        <>
          <div className="lw-enroll__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "enrolled"}
                    className={tab === "enrolled" ? "is-active" : ""} onClick={() => setTab("enrolled")}>
              {t("enrollment.tabEnrolled", { count: roster.enrolled.length })}
            </button>
            <button type="button" role="tab" aria-selected={tab === "invited"}
                    className={tab === "invited" ? "is-active" : ""} onClick={() => setTab("invited")}>
              {t("enrollment.tabInvited", { count: roster.invited.length })}
            </button>
          </div>

          {tab === "enrolled" && (
            roster.enrolled.length === 0 ? (
              <p className="lw-enroll__empty">{t("enrollment.enrolledEmpty")}</p>
            ) : (
              <div className="lw-enroll__grid">
                {roster.enrolled.map((m) => (
                  <div className="lw-enroll__row" key={m.membershipId}>
                    <div className="lw-enroll__avatar">{m.fullName.trim()[0]}</div>
                    <div className="lw-enroll__who">
                      <div className="lw-enroll__name">{m.fullName}</div>
                      <div className="lw-enroll__email">{m.email}</div>
                      <div className="lw-enroll__date">{t("enrollment.enrolledOn", { date: new Date(m.enrolledAt).toLocaleDateString() })}</div>
                    </div>
                    {roster.canManage && (
                      <button type="button" disabled={busy} onClick={() => {
                        if (!window.confirm(t("enrollment.confirmUnenroll", { name: m.fullName }))) return;
                        run(() => api.unenrollMember(session.token, slug, productId, m.membershipId),
                            t("enrollment.toastUnenrolled", { name: m.fullName }));
                      }}>
                        <UserX size={12} /> {t("enrollment.unenroll")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "invited" && (
            roster.invited.length === 0 ? (
              <p className="lw-enroll__empty">{t("enrollment.invitedEmpty")}</p>
            ) : (
              <div className="lw-enroll__grid">
                {roster.invited.map((i) => (
                  <div className="lw-enroll__row" key={i.id}>
                    <div className="lw-enroll__who">
                      <div className="lw-enroll__name">{i.email}</div>
                      <div className="lw-enroll__date">
                        {t("members.invitedAs", { role: humanise(t, i.intendedRole), date: new Date(i.expiresAt).toLocaleDateString() })}
                      </div>
                    </div>
                    <span className={`lw-enroll__status is-${i.status.toLowerCase()}`}>{statusLabel(t, i.status)}</span>
                    {roster.canManage && (
                      <div className="lw-enroll__actions">
                        <button type="button" disabled={busy}
                                onClick={() => run(() => api.resendMemberInvitation(session.token, slug, i.id), t("members.toastInvitationResent", { email: i.email }))}>
                          <RefreshCw size={12} /> {t("members.resend")}
                        </button>
                        {i.status === "Sent" && (
                          <button type="button" disabled={busy}
                                  onClick={() => run(() => api.cancelMemberInvitation(session.token, slug, i.id), t("members.toastInvitationCancelled", { email: i.email }))}>
                            <X size={12} /> {t("members.cancel")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function humanise(t, role) {
  return t(`roles.${role}`) !== `roles.${role}` ? t(`roles.${role}`) : role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function statusLabel(t, status) {
  const key = `members.status${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

const CSS = `
  .lw-enroll__picker {
    display: flex; align-items: center; gap: 10px; margin: 18px 0;
    font-size: 0.85rem; color: var(--ink);
  }
  .lw-enroll__picker select {
    font-family: var(--font-body); font-size: 0.88rem; color: var(--ink);
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 7px 10px; min-width: 220px;
  }
  .lw-enroll__nocourses { font-size: 0.83rem; color: var(--ink-soft); font-style: italic; }
  .lw-enroll__refresh {
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent; border: 1px solid var(--line); border-radius: 6px;
    padding: 6px; color: var(--ink-soft); cursor: pointer;
  }
  .lw-enroll__refresh:hover:not(:disabled) { color: var(--ink); }
  .lw-enroll__refresh:disabled { opacity: 0.45; cursor: not-allowed; }

  .lw-enroll__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-enroll__spin { animation: lwEnrollSpin 0.9s linear infinite; }
  @keyframes lwEnrollSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-enroll__spin { animation: none; } }

  .lw-enroll__tabs { display: flex; align-items: center; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid var(--line); }
  .lw-enroll__tabs button {
    font-family: inherit; font-size: 0.85rem; font-weight: 600; color: var(--ink-soft);
    background: transparent; border: none; border-bottom: 2px solid transparent;
    padding: 9px 14px; cursor: pointer; margin-bottom: -1px;
  }
  .lw-enroll__tabs button.is-active { color: var(--accent); border-bottom-color: var(--accent); }

  .lw-enroll__empty { font-size: 0.83rem; color: var(--ink-soft); font-style: italic; margin-top: 18px; }

  .lw-enroll__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  .lw-enroll__row {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 14px 16px;
  }
  .lw-enroll__avatar {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent-2); color: #fff; font-weight: 700; font-size: 0.9rem; text-transform: uppercase;
  }
  .lw-enroll__who { flex: 1; min-width: 160px; }
  .lw-enroll__name { font-weight: 600; font-size: 0.93rem; overflow-wrap: anywhere; }
  .lw-enroll__email { font-size: 0.79rem; color: var(--ink-soft); margin-top: 2px; overflow-wrap: anywhere; }
  .lw-enroll__date { font-size: 0.78rem; color: var(--ink-soft); margin-top: 3px; }

  .lw-enroll__status {
    font-family: var(--font-mono); font-size: 10px; flex-shrink: 0;
    border-radius: 20px; padding: 3px 9px;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-enroll__status.is-sent { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
  .lw-enroll__status.is-expired { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }

  .lw-enroll__row > button {
    display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
    font-family: var(--font-body); font-size: 11px;
    background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; cursor: pointer;
  }
  .lw-enroll__row > button:hover:not(:disabled) { color: var(--danger); }
  .lw-enroll__row > button:disabled { opacity: 0.45; cursor: not-allowed; }

  .lw-enroll__actions { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; }
  .lw-enroll__actions button {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-body); font-size: 11px;
    background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; cursor: pointer;
  }
  .lw-enroll__actions button:hover:not(:disabled) { color: var(--ink); }
  .lw-enroll__actions button:disabled { opacity: 0.45; cursor: not-allowed; }
`;
