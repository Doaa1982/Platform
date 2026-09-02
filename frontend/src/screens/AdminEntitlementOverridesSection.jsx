import { useEffect, useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   ENTITLEMENT OVERRIDES — Licensing & Entitlements Architecture §16.

   A Platform Operator's support exception on top of whatever a Workspace's
   Subscription/Configuration would otherwise resolve — the backend
   (EntitlementOverrideService/EntitlementOverridesController) has existed
   since the commercial domain was built; this is its first frontend, so the
   only way to grant or revoke one used to be a direct API call.

   Self-contained, same convention as AdminCatalogSection: fetches its own
   workspace list rather than taking one as a prop from AdminScreen.
   ========================================================================= */

/** A few common keys (EntitlementResolutionService's own constants) offered as quick picks — free text is still accepted, since the backend is the real validator. */
const COMMON_KEYS = [
  "credits:ai",
  "capacity:tutors",
  "capacity:learners",
  "capacity:video-storage-gb",
  "capacity:resource-storage-gb",
  "profile:Learning", "profile:Assessment", "profile:Analytics", "profile:Branding",
  "ai:Learning", "ai:Assessment", "ai:Analytics", "ai:Branding",
];

const EMPTY_FORM = { entitlementKey: "", value: "", reason: "", effectiveUntil: "" };

export default function AdminEntitlementOverridesSection() {
  const { session } = useAuth();
  const { t } = useLanguage();

  const [workspaces, setWorkspaces] = useState(null);
  const [slug, setSlug] = useState("");
  const [overrides, setOverrides] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    api.getProvisioningView(session.token)
      .then((rows) => { if (!cancelled) setWorkspaces(rows); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token]);

  function loadOverrides(targetSlug) {
    setOverrides(null);
    api.getEntitlementOverrides(session.token, targetSlug)
      .then(setOverrides)
      .catch((e) => setError(e.message));
  }

  function handleSelectWorkspace(nextSlug) {
    setSlug(nextSlug);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setError(null);
    setSuccess(null);
    if (nextSlug) loadOverrides(nextSlug);
    else setOverrides(null);
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.entitlementKey.trim() || !form.value.trim() || !form.reason.trim()) {
      setError(t("admin.overrideErrRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createEntitlementOverride(session.token, slug, {
        entitlementKey: form.entitlementKey.trim(),
        value: form.value.trim(),
        reason: form.reason.trim(),
        effectiveUntil: form.effectiveUntil ? new Date(form.effectiveUntil).toISOString() : null,
      });
      setSuccess(t("admin.overrideToastCreated"));
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadOverrides(slug);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id) {
    if (!window.confirm(t("admin.overrideConfirmRevoke"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.revokeEntitlementOverride(session.token, slug, id);
      setSuccess(t("admin.overrideToastRevoked"));
      loadOverrides(slug);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pl-admin__overrides">
      <p className="pl-admin__overrideslead">{t("admin.overridesLead")}</p>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      <label className="pl-admin__overrideswspicker">
        {t("admin.overridesWorkspaceLabel")}
        {workspaces === null ? (
          <span className="pl-admin__loading"><LoaderCircle size={14} className="pl-admin__spin" /></span>
        ) : (
          <select value={slug} onChange={(e) => handleSelectWorkspace(e.target.value)}>
            <option value="">{t("admin.overridesWorkspacePlaceholder")}</option>
            {workspaces.map((w) => <option key={w.workspaceId} value={w.slug}>{w.name} (/{w.slug})</option>)}
          </select>
        )}
      </label>

      {slug && overrides === null && (
        <div className="pl-admin__loading"><LoaderCircle size={18} className="pl-admin__spin" /> {t("admin.loading")}</div>
      )}

      {slug && overrides !== null && (
        <>
          <div className="pl-admin__overridesbar">
            <button className="pl-admin__btn" disabled={busy} onClick={() => setShowForm((v) => !v)}>
              <Plus size={14} aria-hidden="true" /> {t("admin.overrideAdd")}
            </button>
          </div>

          {showForm && (
            <form className="pl-admin__overrideform" onSubmit={handleCreate}>
              <label>
                {t("admin.overrideKeyLabel")}
                <input list="entitlement-override-keys" value={form.entitlementKey} disabled={busy}
                       onChange={(e) => setForm((f) => ({ ...f, entitlementKey: e.target.value }))}
                       placeholder="credits:ai" />
                <datalist id="entitlement-override-keys">
                  {COMMON_KEYS.map((k) => <option key={k} value={k} />)}
                </datalist>
              </label>
              <label>
                {t("admin.overrideValueLabel")}
                <input type="text" value={form.value} disabled={busy}
                       onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
              </label>
              <label className="pl-admin__overridereason">
                {t("admin.overrideReasonLabel")}
                <input type="text" value={form.reason} disabled={busy}
                       onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
              </label>
              <label>
                {t("admin.overrideUntilLabel")}
                <input type="date" value={form.effectiveUntil} disabled={busy}
                       onChange={(e) => setForm((f) => ({ ...f, effectiveUntil: e.target.value }))} />
              </label>
              <button type="submit" className="pl-admin__btn" disabled={busy}>{t("admin.overrideSave")}</button>
              <button type="button" className="pl-admin__ghost" disabled={busy} onClick={() => setShowForm(false)}>{t("admin.cancel")}</button>
            </form>
          )}

          {overrides.length === 0 && <p className="pl-admin__overridesempty">{t("admin.overridesEmpty")}</p>}

          {overrides.length > 0 && (
            <table className="pl-admin__table">
              <thead>
                <tr>
                  <th>{t("admin.overrideKeyLabel")}</th>
                  <th>{t("admin.overrideValueLabel")}</th>
                  <th>{t("admin.overrideReasonLabel")}</th>
                  <th>{t("admin.overrideUntilLabel")}</th>
                  <th>{t("admin.colStatus")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id}>
                    <td><code>{o.entitlementKey}</code></td>
                    <td>{o.value}</td>
                    <td>{o.reason}</td>
                    <td>{o.effectiveUntil ? new Date(o.effectiveUntil).toLocaleDateString() : t("admin.overrideNoExpiry")}</td>
                    <td>{o.status}</td>
                    <td>
                      {o.status === "Active" && (
                        <button className="pl-admin__ghost" disabled={busy} onClick={() => handleRevoke(o.id)}>
                          <X size={12} aria-hidden="true" /> {t("admin.overrideRevoke")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
