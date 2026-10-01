import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, CheckCircle2, ArrowRight, Building2 } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryField, EntryLoading } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";
import { formatDate, isolate, roleLabel } from "../i18n/format";

/* =========================================================================
   INVITE SCREEN — /invite/{token}

   Anonymous by necessity: an invitation link has to work for someone with no
   account yet. The token in the URL is the credential, and Workspace
   Resolution happens before any authentication.

   Two shapes, decided by whether the invited email already owns an Identity:
     new person      → name + a password to set
     existing person → their existing password, to prove it is really them
                        rather than merely someone holding the link
   ========================================================================= */

export default function InviteScreen({ token, onAccepted }) {
  const { adoptSession } = useAuth();
  const { t, lang } = useLanguage();

  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.previewInvitation(token)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setLoadError(e); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const session = await api.acceptInvitation(token, {
        fullName: preview.accountExists ? undefined : fullName.trim(),
        password,
      });

      // Through the provider, never straight to storage: whoever was signed in
      // before — very often the admin who just copied this link — must be
      // replaced, not left in place for the next screen to read.
      adoptSession({
        token: session.token,
        expiresAt: session.expiresAt,
        fullName: session.fullName,
      });
      setDone(true);
      // Let them read the confirmation before the app takes over
      setTimeout(() => onAccepted(), 1200);
    } catch (e) {
      setError(apiErrorMessage(t, e, {
        400: "invite.errMissing", 401: "invite.errWrongPassword",
        404: "invite.cantOpenBody", 409: "invite.cantOpenBody", 410: "invite.cantOpenBody",
      }));
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <EntryShell>
        <EntryCard icon={AlertCircle} tone="bad" title={t("invite.cantOpenTitle")}
                   lead={apiErrorMessage(t, loadError, { 404: "invite.cantOpenBody", 409: "invite.cantOpenBody", 410: "invite.cantOpenBody" })}>
          <p className="lw-entry__note">{t("invite.cantOpenHint")}</p>
        </EntryCard>
      </EntryShell>
    );
  }

  if (!preview) return <EntryLoading label={t("invite.checking")} />;

  const workspace = isolate(preview.workspaceName);

  if (done) {
    return (
      <EntryShell>
        <EntryCard icon={CheckCircle2} tone="good" title={t("invite.doneTitle")} lead={t("invite.doneBody", { workspace })} />
      </EntryShell>
    );
  }

  return (
    <EntryShell>
      <EntryCard icon={Building2} eyebrow={t("invite.eyebrow")} title={t("invite.joinTitle", { workspace })}
                 lead={t("invite.lead", { role: roleLabel(t, preview.intendedRole), email: isolate(preview.email) })}>
        <form className="lw-entry__form" onSubmit={handleSubmit} noValidate>
          {error && <div className="lw-entry__alert lw-entry__alert--bad" role="alert">{error}</div>}

          {!preview.accountExists && (
            <EntryField label={t("invite.nameLabel")}>
              <input
                type="text" autoComplete="name" required autoFocus dir="auto"
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder={t("invite.namePlaceholder")} disabled={submitting}
              />
            </EntryField>
          )}

          <EntryField
            label={preview.accountExists ? t("invite.existingPasswordLabel") : t("invite.newPasswordLabel")}
            hint={preview.accountExists ? t("invite.existingAccountNote") : null}
          >
            <input
              type="password" autoComplete={preview.accountExists ? "current-password" : "new-password"}
              required autoFocus={preview.accountExists}
              value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting}
            />
          </EntryField>

          <button type="submit" className="lw-btn lw-btn--accent"
                  disabled={submitting || !password || (!preview.accountExists && !fullName.trim())}>
            {submitting
              ? (<><LoaderCircle size={16} className="lw-entry__spin" aria-hidden="true" /> {t("invite.accepting")}</>)
              : (<>{t("invite.acceptInvitation")} <ArrowRight size={16} className="lw-flip" aria-hidden="true" /></>)}
          </button>
        </form>

        <p className="lw-entry__note">{t("invite.validUntil", { date: isolate(formatDate(lang, preview.expiresAt, { dateStyle: "long" })) })}</p>
      </EntryCard>
    </EntryShell>
  );
}
