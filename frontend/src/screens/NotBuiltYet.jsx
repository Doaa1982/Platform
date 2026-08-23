import { Hammer, ArrowRight } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import Notice from "../components/Notice";

/* =========================================================================
   NOT BUILT YET — for workspace areas whose domain does not exist.

   These screens previously rendered fixture data: courses nobody wrote,
   learners nobody enrolled, revenue nobody earned. Harmless in a prototype
   shown to stakeholders; actively misleading now that real tutors sign in and
   see it presented as their own academy.

   This replaces that with the truth. It deliberately shows no zeroed metrics
   either — a "0 enrolled" implies the feature works and the answer is zero,
   when in fact nothing is measuring anything.
   ========================================================================= */

export default function NotBuiltYet({ area, blurb, next, onNavigate }) {
  const { t } = useLanguage();
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">{area}</div>
      <h1>{t("notBuiltYet.heading")}</h1>

      <Notice
        tone="empty" layout="row" icon={Hammer}
        action={next && (
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={() => onNavigate(next.to)}>
            {next.text} <ArrowRight size={14} />
          </button>
        )}
      >
        <p>{blurb}</p>
        <p>{t("notBuiltYet.note")}</p>
      </Notice>
    </div>
  );
}
