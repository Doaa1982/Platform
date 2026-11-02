import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, MailX } from "lucide-react";
import * as api from "../api/client";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryLoading } from "../components/EntryShell";
import { STORAGE_KEY } from "../i18n/languageStore";

/* =========================================================================
   PARENT LINK — /parent/confirm/{token} and /parent/unsubscribe/{token}

   The two links in a parent's emails (Parent Progress Reports Business
   Analysis §7). Parents have no account: the signed token is the whole
   authorisation, and opening the page is the click — "Yes, send me updates"
   or the one-click unsubscribe — so it acts as soon as it loads. The page
   switches to the parent's own email language once the server says which,
   unless this browser already has a language chosen.
   ========================================================================= */

const LOOK = {
  Confirmed:    { icon: CheckCircle2, tone: "good", key: "confirmed" },
  Unsubscribed: { icon: MailX,        tone: "muted", key: "unsubscribed" },
  Expired:      { icon: AlertCircle,  tone: "bad", key: "expired" },
  Invalid:      { icon: AlertCircle,  tone: "bad", key: "invalid" },
};

export default function ParentLinkScreen({ action, token }) {
  const { t, setLang } = useLanguage();
  const [result, setResult] = useState(null);
  const languageSet = useRef(false);
  // Read during the first render, before LanguageProvider's effect stores its default.
  const [hadLanguageChoice] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return true; }
  });

  useEffect(() => {
    let cancelled = false;
    api.redeemParentLink(action, token)
      .then((r) => {
        if (cancelled) return;
        if (!hadLanguageChoice && !languageSet.current && (r.language === "ar" || r.language === "en")) {
          languageSet.current = true;
          setLang(r.language);
        }
        setResult(r);
      })
      .catch(() => { if (!cancelled) setResult({ status: "Invalid" }); });
    return () => { cancelled = true; };
  }, [action, token, setLang, hadLanguageChoice]);

  if (!result) return <EntryLoading label={t("parentLink.checking")} />;

  const look = LOOK[result.status] ?? LOOK.Invalid;
  const vars = { workspace: result.workspaceName ?? "", learner: result.learnerFirstName ?? "" };
  return (
    <EntryShell>
      <EntryCard icon={look.icon} tone={look.tone} eyebrow={result.workspaceName || undefined} titleDir="auto"
                 title={t(`parentLink.${look.key}Title`, vars)} lead={t(`parentLink.${look.key}Body`, vars)} />
    </EntryShell>
  );
}
