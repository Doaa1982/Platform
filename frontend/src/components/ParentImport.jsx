import { useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Download, LoaderCircle, UploadCloud } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import { downloadParentTemplate } from "../utils/parentContacts";

/* =========================================================================
   SPREADSHEET → PARENTS — the shared upload, preview and template behind
   "Upload a spreadsheet" on bulk invite and "Import parents" on the Members
   screen (Parent Progress Reports Business Analysis §6.3).

   The server reads the file (.csv or .xlsx) and reports every row's problems;
   nothing is saved by a preview. Rows with a problem can't be included — the
   tutor fixes them in the file and uploads again, or leaves them out.
   ========================================================================= */

/** The column guide shown next to every upload, in the tutor's language. */
export function ParentImportGuide({ mode }) {
  const { t } = useLanguage();
  return (
    <details className="lw-pimport__guide">
      <summary>{t("parentImport.guideSummary")}</summary>
      <p>{t(mode === "existing" ? "parentImport.guideExisting" : "parentImport.guideInvite")}</p>
      <dl>
        <dt><code>student_email</code></dt><dd>{t("parentImport.colStudentEmail")}</dd>
        <dt><code>parent1_name</code>, <code>parent2_name</code></dt><dd>{t("parentImport.colName")}</dd>
        <dt><code>parent1_email</code>, <code>parent2_email</code></dt><dd>{t("parentImport.colEmail")}</dd>
        <dt><code>parent1_whatsapp</code>, <code>parent2_whatsapp</code></dt><dd>{t("parentImport.colWhatsapp")}</dd>
        <dt><code>parent1_language</code>, <code>parent2_language</code></dt><dd>{t("parentImport.colLanguage")}</dd>
      </dl>
      <button type="button" className="lw-pimport__template" onClick={downloadParentTemplate}>
        <Download size={12} /> {t("parentImport.downloadTemplate")}
      </button>
    </details>
  );
}

/**
 * Pick a file → the server's preview. Calls onPreview(preview) with { rows, fileProblem }.
 * `mode` is "invite" or "existing".
 */
export function ParentImportUpload({ mode, onPreview, disabled }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState(null);

  async function handle(picked) {
    if (!picked) return;
    setFile(picked); setError(null); setReading(true);
    try { onPreview(await api.previewParentImport(session.token, workspace.slug, mode, picked)); }
    catch (e) { setError(e.message); onPreview(null); }
    finally { setReading(false); }
  }

  return (
    <div>
      {/* Not a <label> around the input: see MembersScreen's dropzone note (double file dialogs). */}
      <div className="lw-dropzone lw-dropzone--compact" role="button" tabIndex={0} aria-disabled={disabled || reading}
           onClick={() => !disabled && !reading && inputRef.current?.click()}
           onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled && !reading) { e.preventDefault(); inputRef.current?.click(); } }}>
        {reading ? <LoaderCircle size={22} className="lw-pimport__spin" /> : <UploadCloud size={22} />}
        <span className="lw-dropzone__title">{file ? file.name : t("parentImport.choose")}</span>
        <span className="lw-dropzone__meta">{t("parentImport.chooseHint")}</span>
        <input ref={inputRef} type="file" style={{ display: "none" }}
               accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
               onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {error && <p className="lw-pimport__error" role="alert">{error}</p>}
    </div>
  );
}

/**
 * Every row with its status. OK rows can be ticked in or out; rows with a problem are shown
 * with what's wrong and can't be included. `selected` is a Set of row numbers.
 */
export function ParentImportPreview({ preview, selected, onToggle, showStudentName = false }) {
  const { t } = useLanguage();
  if (!preview) return null;
  if (preview.fileProblem) {
    return <p className="lw-pimport__error" role="alert">{t(`parentImport.file.${preview.fileProblem}`)}</p>;
  }
  const ok = preview.rows.filter((r) => r.problems.length === 0).length;
  const bad = preview.rows.length - ok;
  return (
    <div className="lw-pimport__preview">
      <p className="lw-pimport__summary">
        {t("parentImport.summary", { ok, total: preview.rows.length })}
        {bad > 0 && <> {" "}<span className="is-warn">{t("parentImport.summaryProblems", { count: bad })}</span></>}
      </p>
      <div className="lw-pimport__scroll">
        <table className="lw-pimport__table">
          <thead>
            <tr>
              <th><span className="lw-pimport__sr">{t("parentImport.colInclude")}</span></th>
              <th>{t("parentImport.colRow")}</th>
              <th>{t("parentImport.colStudent")}</th>
              <th>{t("parentImport.colParents")}</th>
              <th>{t("parentImport.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r) => {
              const isOk = r.problems.length === 0;
              return (
                <tr key={r.rowNumber} className={isOk ? "" : "is-problem"}>
                  <td>
                    <input type="checkbox" checked={isOk && selected.has(r.rowNumber)} disabled={!isOk}
                           aria-label={t("parentImport.includeRow", { row: r.rowNumber })}
                           onChange={() => onToggle(r.rowNumber)} />
                  </td>
                  <td>{r.rowNumber}</td>
                  <td>
                    <span dir="ltr">{r.studentEmail || "—"}</span>
                    {showStudentName && r.studentName && <div className="lw-pimport__sub" dir="auto">{r.studentName}</div>}
                  </td>
                  <td>
                    {r.parents.length === 0 ? <span className="lw-pimport__sub">{t("parentImport.noParents")}</span>
                      : r.parents.map((p, i) => (
                        <div key={i}><span dir="auto">{p.name || "—"}</span> <span className="lw-pimport__sub" dir="ltr">{p.email}</span></div>
                      ))}
                  </td>
                  <td>
                    {isOk ? (
                      <span className="lw-pimport__ok"><CheckCircle2 size={12} /> {t("parentImport.ok")}</span>
                    ) : (
                      <ul className="lw-pimport__problems">
                        {r.problems.map((p) => <li key={p}><AlertCircle size={12} /> {t(`parentImport.problem.${p}`)}</li>)}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {bad > 0 && <p className="lw-pimport__hint">{t("parentImport.fixHint")}</p>}
    </div>
  );
}
