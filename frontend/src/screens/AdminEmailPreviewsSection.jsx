import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import { LANGUAGES } from "../i18n/languageStore";
import Message from "../components/Message";

const WIDTHS = { desktop: 680, mobile: 375 };

/**
 * Platform operators: every email template rendered with sample data, in English or Arabic, at
 * desktop or phone width — for reviewing before email is switched on. Nothing is sent. The HTML
 * renders in a sandboxed iframe (no scripts, no same-origin access), exactly as a mail client
 * would receive it.
 */
export default function AdminEmailPreviewsSection() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const [templates, setTemplates] = useState(null);
  const [template, setTemplate] = useState(null);
  const [language, setLanguage] = useState("en");
  const [width, setWidth] = useState("desktop");
  const [format, setFormat] = useState("html");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getEmailPreviews(session.token)
      .then((list) => {
        if (cancelled) return;
        setTemplates(list);
        setTemplate((current) => current ?? list[0]?.template ?? null);
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token]);

  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    api.getEmailPreview(session.token, template, language)
      .then((p) => { if (!cancelled) { setPreview(p); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, template, language]);

  if (error && !templates) return <Message type="error">{error}</Message>;
  if (!templates) return <div className="pl-emailpreview__loading"><LoaderCircle size={16} className="pl-admin__spin" /></div>;

  return (
    <div className="pl-emailpreview">
      <style>{CSS}</style>
      <p className="pl-emailpreview__intro">{t("admin.emailPreviewsIntro")}</p>

      <div className="pl-emailpreview__controls">
        <label>
          <span>{t("admin.emailPreviewsTemplate")}</span>
          <select value={template ?? ""} onChange={(e) => setTemplate(e.target.value)}>
            {templates.map((x) => (
              <option key={x.template} value={x.template}>{t(`admin.emailTemplate${x.template}`)}</option>
            ))}
          </select>
        </label>
        <Segmented value={language} onChange={setLanguage}
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.nativeLabel }))} />
        <Segmented value={width} onChange={setWidth}
          options={[{ value: "desktop", label: t("admin.emailPreviewsDesktop") }, { value: "mobile", label: t("admin.emailPreviewsMobile") }]} />
        <Segmented value={format} onChange={setFormat}
          options={[{ value: "html", label: "HTML" }, { value: "text", label: t("admin.emailPreviewsPlainText") }]} />
      </div>

      {error && <Message type="error">{error}</Message>}

      {preview && (
        <>
          <dl className="pl-emailpreview__meta">
            <dt>{t("admin.emailPreviewsFrom")}</dt><dd><bdi>{preview.fromDisplayName}</bdi></dd>
            {preview.replyTo && <><dt>{t("admin.emailPreviewsReplyTo")}</dt><dd>{preview.replyTo}</dd></>}
            <dt>{t("admin.emailPreviewsSubject")}</dt><dd><bdi>{preview.subject}</bdi></dd>
            <dt>{t("admin.emailPreviewsRecipient")}</dt><dd>{t(`admin.emailRecipient${preview.template}`)}</dd>
          </dl>
          <div className="pl-emailpreview__frame" style={{ width: WIDTHS[width] }}>
            {format === "html" ? (
              <iframe title={preview.subject} sandbox="" srcDoc={preview.html} />
            ) : (
              <pre dir={preview.language === "ar" ? "rtl" : "ltr"}>{preview.text}</pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="pl-emailpreview__seg" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value}
                className={value === o.value ? "is-active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const CSS = `
  .pl-emailpreview { display: flex; flex-direction: column; gap: 14px; }
  .pl-emailpreview__intro { margin: 0; color: var(--pl-ink-soft, #6A7383); font-size: 0.85rem; }
  .pl-emailpreview__loading { padding: 24px; }
  .pl-emailpreview__controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
  .pl-emailpreview__controls label { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; }
  .pl-emailpreview__controls select { padding: 7px 10px; border-radius: 8px; border: 1px solid #D5DAE1; font-size: 0.88rem; }
  .pl-emailpreview__seg { display: inline-flex; border: 1px solid #D5DAE1; border-radius: 8px; overflow: hidden; }
  .pl-emailpreview__seg button { border: 0; background: #fff; padding: 7px 12px; font-size: 0.82rem; cursor: pointer; }
  .pl-emailpreview__seg button + button { border-inline-start: 1px solid #D5DAE1; }
  .pl-emailpreview__seg button.is-active { background: #1B2430; color: #fff; }
  .pl-emailpreview__meta { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; font-size: 0.85rem; }
  .pl-emailpreview__meta dt { color: #6A7383; }
  .pl-emailpreview__meta dd { margin: 0; font-weight: 600; }
  .pl-emailpreview__frame { max-width: 100%; border: 1px solid #D5DAE1; border-radius: 10px; overflow: hidden; background: #fff; }
  .pl-emailpreview__frame iframe { display: block; width: 100%; height: 760px; border: 0; }
  .pl-emailpreview__frame pre { margin: 0; padding: 16px; white-space: pre-wrap; font-size: 0.82rem; line-height: 1.5; }
`;
