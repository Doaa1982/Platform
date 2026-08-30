import { useLanguage } from "../i18n/useLanguage";

/**
 * Per-AssessedObjective mastery (Competency-Based Learning — Design
 * Proposal §3-4), shown wherever a real graded result is (in-video
 * checkpoints and the Standalone quiz, both real/adaptive). Renders nothing
 * when no answered question was tagged with an objective — the backward-
 * compatibility guarantee the whole proposal depends on (an empty array,
 * not a placeholder).
 */
export default function CompetencyBreakdown({ levels }) {
  const { t } = useLanguage();
  if (!levels || levels.length === 0) return null;
  return (
    <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600 }}>{t("learnerLesson.competencyTitle")}</p>
      {levels.map((c) => (
        <div key={c.objective} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: "0.85rem" }}>
          <span>{c.objective}</span>
          <span className={`lw-tag lw-tag--competency-${c.level.toLowerCase()}`}>{t(`learnerLesson.competency${c.level}`)}</span>
        </div>
      ))}
    </div>
  );
}
