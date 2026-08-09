import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Plus, X, Send, Archive } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   CATALOG — Products (Solo plans) and Packs (Capability Packs), database-
   backed. "Editing a price" always means creating a new Draft version and
   publishing it — an existing version's numbers are never patched. No
   review-gate workflow: any Platform Operator can publish directly.
   ========================================================================= */

const LEVELS = ["Foundation", "Professional", "AiPlus"];
const DOMAINS = ["Learning", "Assessment", "Analytics", "Branding"];

const LEVEL_KEY = { Foundation: "subscription.levelFoundation", Professional: "subscription.levelProfessional", AiPlus: "subscription.levelAiPlus" };
const levelLabel = (t, v) => (v ? t(LEVEL_KEY[v] ?? "") || v : "—");
const DOMAIN_KEY = { Learning: "subscription.domainLearning", Assessment: "subscription.domainAssessment", Analytics: "subscription.domainAnalytics", Branding: "subscription.domainBranding" };
const domainLabel = (t, v) => (v ? t(DOMAIN_KEY[v] ?? "") || v : "—");
const CATALOG_STATUS_KEY = { Draft: "admin.catalogDraft", Published: "admin.catalogPublished", Retired: "admin.catalogRetired" };
const catalogStatusLabel = (t, v) => t(CATALOG_STATUS_KEY[v] ?? "") || v;

const EMPTY_PRODUCT_VERSION = {
  monthlyPrice: "", annualPrice: "", currency: "USD",
  tutorCapacityBase: "1", tutorCapacityMax: "1", aiCreditsIncluded: "",
  learningProfile: "Foundation", assessmentProfile: "Foundation", analyticsProfile: "Foundation", brandingProfile: "Foundation",
};

const EMPTY_PACK_VERSION = {
  monthlyPrice: "", currency: "USD",
  learningGrant: "", assessmentGrant: "", analyticsGrant: "", brandingGrant: "",
  extraTutorCapacity: "0", requiresDomain: "", requiresMinLevel: "",
};

export default function AdminCatalogSection() {
  const { session } = useAuth();
  const { t } = useLanguage();

  const [products, setProducts] = useState(null);
  const [packs, setPacks] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(null);        // "product" | "pack" | null
  const [versioning, setVersioning] = useState(null);     // the product/pack row getting a new version

  const load = useCallback(
    () => Promise.all([api.getAdminProducts(session.token), api.getAdminPacks(session.token)])
      .then(([p, k]) => { setProducts(p); setPacks(k); setError(null); })
      .catch((e) => setError(e.message)),
    [session.token]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getAdminProducts(session.token), api.getAdminPacks(session.token)])
      .then(([p, k]) => { if (!cancelled) { setProducts(p); setPacks(k); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token]);

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMessage) setSuccess(successMessage);
      await load();
      return r;
    }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  if (error && !products) {
    return <Message type="error">{error}</Message>;
  }
  if (!products || !packs) {
    return <div className="pl-admin__loading"><LoaderCircle size={20} className="pl-admin__spin" aria-hidden="true" /> {t("admin.loadingCatalog")}</div>;
  }

  return (
    <div>
      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      <section className="pl-admin__subs">
        <div className="pl-admin__subshead">
          <h2 className="pl-admin__h2">{t("admin.products")}</h2>
          <button className="pl-admin__btn" disabled={busy} onClick={() => setCreating("product")}>
            <Plus size={14} aria-hidden="true" /> {t("admin.newProduct")}
          </button>
        </div>
        <div className="pl-admin__cataloggrid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} busy={busy} t={t}
              onNewVersion={() => setVersioning({ kind: "product", row: p })}
              onPublish={(versionId) => run(() => api.publishProductVersion(session.token, p.id, versionId), t("admin.toastProductVersionPublished", { name: p.name }))}
              onRetire={() => run(() => api.retireProduct(session.token, p.id), t("admin.toastProductRetired", { name: p.name }))} />
          ))}
        </div>
      </section>

      <section className="pl-admin__subs">
        <div className="pl-admin__subshead">
          <h2 className="pl-admin__h2">{t("admin.packs")}</h2>
          <button className="pl-admin__btn" disabled={busy} onClick={() => setCreating("pack")}>
            <Plus size={14} aria-hidden="true" /> {t("admin.newPack")}
          </button>
        </div>
        <div className="pl-admin__cataloggrid">
          {packs.map((p) => (
            <PackCard key={p.id} pack={p} busy={busy} t={t}
              onNewVersion={() => setVersioning({ kind: "pack", row: p })}
              onPublish={(versionId) => run(() => api.publishPackVersion(session.token, p.id, versionId), t("admin.toastPackVersionPublished", { name: p.name }))}
              onRetire={() => run(() => api.retirePack(session.token, p.id), t("admin.toastPackRetired", { name: p.name }))} />
          ))}
        </div>
      </section>

      {creating === "product" && (
        <ProductFormModal busy={busy} t={t} onClose={() => setCreating(null)}
          onSubmit={async (body) => { const r = await run(() => api.createCatalogProduct(session.token, body), t("admin.toastProductCreated", { name: body.name })); if (r) setCreating(null); }} />
      )}
      {creating === "pack" && (
        <PackFormModal busy={busy} t={t} onClose={() => setCreating(null)}
          onSubmit={async (body) => { const r = await run(() => api.createPack(session.token, body), t("admin.toastPackCreated", { name: body.name })); if (r) setCreating(null); }} />
      )}
      {versioning?.kind === "product" && (
        <ProductVersionModal product={versioning.row} busy={busy} t={t} onClose={() => setVersioning(null)}
          onSubmit={async (version) => { const r = await run(() => api.createProductVersion(session.token, versioning.row.id, version), t("admin.toastDraftVersionCreated")); if (r) setVersioning(null); }} />
      )}
      {versioning?.kind === "pack" && (
        <PackVersionModal pack={versioning.row} busy={busy} t={t} onClose={() => setVersioning(null)}
          onSubmit={async (version) => { const r = await run(() => api.createPackVersion(session.token, versioning.row.id, version), t("admin.toastDraftVersionCreated")); if (r) setVersioning(null); }} />
      )}
    </div>
  );
}

// ── Product ──────────────────────────────────────────────────────────────

function ProductCard({ product: p, busy, t, onNewVersion, onPublish, onRetire }) {
  const v = p.currentVersion;
  return (
    <div className={`pl-admin__catalogcard ${p.status === "Retired" ? "is-retired" : ""}`}>
      <div className="pl-admin__catalogcardhead">
        <strong>{p.name}</strong>
        <span className={`pl-admin__pill ${p.status === "Published" ? "is-ok" : p.status === "Retired" ? "" : "is-warn"}`}>{catalogStatusLabel(t, p.status)}</span>
      </div>
      <span className="pl-admin__slug">/{p.code}</span>

      {v ? (
        <div className="pl-admin__proplist">
          <span>{t("subscription.perMonth")}</span><span>{v.monthlyPrice} {v.currency}</span>
          <span>{t("subscription.perYear")}</span><span>{v.annualPrice} {v.currency}</span>
          <span>{t("subscription.tutorCapacity")}</span><span>{v.tutorCapacityBase}–{v.tutorCapacityMax}</span>
          <span>{t("subscription.aiCredits")}</span><span>{v.aiCreditsIncluded}</span>
          <span>{domainLabel(t, "Learning")}</span><span>{levelLabel(t, v.learningProfile)}</span>
          <span>{domainLabel(t, "Assessment")}</span><span>{levelLabel(t, v.assessmentProfile)}</span>
          <span>{domainLabel(t, "Analytics")}</span><span>{levelLabel(t, v.analyticsProfile)}</span>
          <span>{domainLabel(t, "Branding")}</span><span>{levelLabel(t, v.brandingProfile)}</span>
        </div>
      ) : <p className="pl-admin__muted">{t("admin.noPublishedVersion")}</p>}

      {p.draftVersion && (
        <div className="pl-admin__draftbanner">
          {t("admin.draftPendingVersion", { number: p.draftVersion.versionNumber })}
          <button disabled={busy} onClick={() => onPublish(p.draftVersion.id)}><Send size={12} aria-hidden="true" /> {t("admin.publish")}</button>
        </div>
      )}

      <div className="pl-admin__actions">
        <button disabled={busy || !!p.draftVersion || p.status === "Retired"} onClick={onNewVersion}>
          <Plus size={12} aria-hidden="true" /> {t("admin.newVersion")}
        </button>
        {p.status !== "Retired" && (
          <button disabled={busy} onClick={onRetire}><Archive size={12} aria-hidden="true" /> {t("admin.retire")}</button>
        )}
      </div>
    </div>
  );
}

function ProductFormModal({ busy, t, onClose, onSubmit }) {
  const [familyCode, setFamilyCode] = useState("solo");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState(EMPTY_PRODUCT_VERSION);

  return (
    <div className="pl-admin__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pl-admin__panel" onClick={(e) => e.stopPropagation()}>
        <button className="pl-admin__panelclose" onClick={onClose} aria-label={t("admin.close")}><X size={16} /></button>
        <h2 className="pl-admin__panelh2">{t("admin.newProduct")}</h2>
        <form className="pl-admin__formrow" noValidate onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ familyCode, code, name, version: numericVersion(version) });
        }}>
          <label><span>{t("admin.familyCode")}</span><input value={familyCode} onChange={(e) => setFamilyCode(e.target.value)} disabled={busy} required /></label>
          <label><span>{t("admin.code")}</span><input value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} required placeholder="solo-essential" /></label>
          <label><span>{t("admin.name")}</span><input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} required placeholder="Solo Essential" /></label>
          <ProductVersionFields version={version} setVersion={setVersion} busy={busy} t={t} />
          <div className="pl-admin__formactions">
            <button type="button" className="pl-admin__ghost" onClick={onClose} disabled={busy}>{t("admin.close")}</button>
            <button type="submit" className="pl-admin__btn" disabled={busy}>{t("admin.create")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductVersionModal({ product, busy, t, onClose, onSubmit }) {
  const [version, setVersion] = useState(EMPTY_PRODUCT_VERSION);
  return (
    <div className="pl-admin__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pl-admin__panel" onClick={(e) => e.stopPropagation()}>
        <button className="pl-admin__panelclose" onClick={onClose} aria-label={t("admin.close")}><X size={16} /></button>
        <h2 className="pl-admin__panelh2">{t("admin.newVersionOf", { name: product.name })}</h2>
        <form className="pl-admin__formrow" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(numericVersion(version)); }}>
          <ProductVersionFields version={version} setVersion={setVersion} busy={busy} t={t} />
          <div className="pl-admin__formactions">
            <button type="button" className="pl-admin__ghost" onClick={onClose} disabled={busy}>{t("admin.close")}</button>
            <button type="submit" className="pl-admin__btn" disabled={busy}>{t("admin.saveDraft")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductVersionFields({ version: v, setVersion, busy, t }) {
  const set = (k) => (e) => setVersion((s) => ({ ...s, [k]: e.target.value }));
  return (
    <>
      <label><span>{t("subscription.perMonth")}</span><input type="number" step="0.01" min="0" value={v.monthlyPrice} onChange={set("monthlyPrice")} disabled={busy} required /></label>
      <label><span>{t("subscription.perYear")}</span><input type="number" step="0.01" min="0" value={v.annualPrice} onChange={set("annualPrice")} disabled={busy} required /></label>
      <label><span>{t("admin.currency")}</span><input value={v.currency} onChange={set("currency")} disabled={busy} required /></label>
      <label><span>{t("admin.tutorCapacityBase")}</span><input type="number" min="1" value={v.tutorCapacityBase} onChange={set("tutorCapacityBase")} disabled={busy} required /></label>
      <label><span>{t("admin.tutorCapacityMax")}</span><input type="number" min="1" value={v.tutorCapacityMax} onChange={set("tutorCapacityMax")} disabled={busy} required /></label>
      <label><span>{t("subscription.aiCredits")}</span><input type="number" min="0" value={v.aiCreditsIncluded} onChange={set("aiCreditsIncluded")} disabled={busy} required /></label>
      <label><span>{domainLabel(t, "Learning")}</span><LevelSelect value={v.learningProfile} onChange={set("learningProfile")} busy={busy} t={t} /></label>
      <label><span>{domainLabel(t, "Assessment")}</span><LevelSelect value={v.assessmentProfile} onChange={set("assessmentProfile")} busy={busy} t={t} /></label>
      <label><span>{domainLabel(t, "Analytics")}</span><LevelSelect value={v.analyticsProfile} onChange={set("analyticsProfile")} busy={busy} t={t} /></label>
      <label><span>{domainLabel(t, "Branding")}</span><LevelSelect value={v.brandingProfile} onChange={set("brandingProfile")} busy={busy} t={t} /></label>
    </>
  );
}

function numericVersion(v) {
  return {
    ...v,
    monthlyPrice: Number(v.monthlyPrice), annualPrice: Number(v.annualPrice ?? v.monthlyPrice),
    tutorCapacityBase: Number(v.tutorCapacityBase), tutorCapacityMax: Number(v.tutorCapacityMax),
    aiCreditsIncluded: Number(v.aiCreditsIncluded),
    extraTutorCapacity: v.extraTutorCapacity !== undefined ? Number(v.extraTutorCapacity) : undefined,
    learningGrant: v.learningGrant || null, assessmentGrant: v.assessmentGrant || null,
    analyticsGrant: v.analyticsGrant || null, brandingGrant: v.brandingGrant || null,
    requiresDomain: v.requiresDomain || null, requiresMinLevel: v.requiresMinLevel || null,
  };
}

// ── Pack ─────────────────────────────────────────────────────────────────

function PackCard({ pack: p, busy, t, onNewVersion, onPublish, onRetire }) {
  const v = p.currentVersion;
  return (
    <div className={`pl-admin__catalogcard ${p.status === "Retired" ? "is-retired" : ""}`}>
      <div className="pl-admin__catalogcardhead">
        <strong>{p.name}</strong>
        <span className={`pl-admin__pill ${p.status === "Published" ? "is-ok" : p.status === "Retired" ? "" : "is-warn"}`}>{catalogStatusLabel(t, p.status)}</span>
      </div>
      <span className="pl-admin__slug">{p.code}</span>

      {v ? (
        <div className="pl-admin__proplist">
          <span>{t("subscription.perMonth")}</span><span>{v.monthlyPrice} {v.currency}</span>
          {DOMAINS.map((d) => {
            const key = `${d.charAt(0).toLowerCase()}${d.slice(1)}Grant`;
            return v[key] ? (
              <>
                <span key={`${d}-l`}>{domainLabel(t, d)}</span>
                <span key={`${d}-v`}>{levelLabel(t, v[key])}</span>
              </>
            ) : null;
          })}
          {v.extraTutorCapacity > 0 && (<><span>{t("subscription.tutorCapacity")}</span><span>+{v.extraTutorCapacity}</span></>)}
          {v.requiresDomain && (<><span>{t("admin.requires")}</span><span>{domainLabel(t, v.requiresDomain)} ≥ {levelLabel(t, v.requiresMinLevel)}</span></>)}
        </div>
      ) : <p className="pl-admin__muted">{t("admin.noPublishedVersion")}</p>}

      {p.draftVersion && (
        <div className="pl-admin__draftbanner">
          {t("admin.draftPendingVersion", { number: p.draftVersion.versionNumber })}
          <button disabled={busy} onClick={() => onPublish(p.draftVersion.id)}><Send size={12} aria-hidden="true" /> {t("admin.publish")}</button>
        </div>
      )}

      <div className="pl-admin__actions">
        <button disabled={busy || !!p.draftVersion || p.status === "Retired"} onClick={onNewVersion}>
          <Plus size={12} aria-hidden="true" /> {t("admin.newVersion")}
        </button>
        {p.status !== "Retired" && (
          <button disabled={busy} onClick={onRetire}><Archive size={12} aria-hidden="true" /> {t("admin.retire")}</button>
        )}
      </div>
    </div>
  );
}

function PackFormModal({ busy, t, onClose, onSubmit }) {
  const [code, setCode] = useState("AiAuthor");
  const [name, setName] = useState("");
  const [version, setVersion] = useState(EMPTY_PACK_VERSION);

  return (
    <div className="pl-admin__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pl-admin__panel" onClick={(e) => e.stopPropagation()}>
        <button className="pl-admin__panelclose" onClick={onClose} aria-label={t("admin.close")}><X size={16} /></button>
        <h2 className="pl-admin__panelh2">{t("admin.newPack")}</h2>
        <form className="pl-admin__formrow" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit({ code, name, version: numericVersion(version) }); }}>
          <label><span>{t("admin.code")}</span><input value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} required placeholder="AiAuthor" /></label>
          <label><span>{t("admin.name")}</span><input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} required placeholder="AI Author" /></label>
          <PackVersionFields version={version} setVersion={setVersion} busy={busy} t={t} />
          <div className="pl-admin__formactions">
            <button type="button" className="pl-admin__ghost" onClick={onClose} disabled={busy}>{t("admin.close")}</button>
            <button type="submit" className="pl-admin__btn" disabled={busy}>{t("admin.create")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PackVersionModal({ pack, busy, t, onClose, onSubmit }) {
  const [version, setVersion] = useState(EMPTY_PACK_VERSION);
  return (
    <div className="pl-admin__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pl-admin__panel" onClick={(e) => e.stopPropagation()}>
        <button className="pl-admin__panelclose" onClick={onClose} aria-label={t("admin.close")}><X size={16} /></button>
        <h2 className="pl-admin__panelh2">{t("admin.newVersionOf", { name: pack.name })}</h2>
        <form className="pl-admin__formrow" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(numericVersion(version)); }}>
          <PackVersionFields version={version} setVersion={setVersion} busy={busy} t={t} />
          <div className="pl-admin__formactions">
            <button type="button" className="pl-admin__ghost" onClick={onClose} disabled={busy}>{t("admin.close")}</button>
            <button type="submit" className="pl-admin__btn" disabled={busy}>{t("admin.saveDraft")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PackVersionFields({ version: v, setVersion, busy, t }) {
  const set = (k) => (e) => setVersion((s) => ({ ...s, [k]: e.target.value }));
  return (
    <>
      <label><span>{t("subscription.perMonth")}</span><input type="number" step="0.01" min="0" value={v.monthlyPrice} onChange={set("monthlyPrice")} disabled={busy} required /></label>
      <label><span>{t("admin.currency")}</span><input value={v.currency} onChange={set("currency")} disabled={busy} required /></label>
      <label><span>{domainLabel(t, "Learning")}</span><LevelSelect value={v.learningGrant} onChange={set("learningGrant")} busy={busy} t={t} allowNone /></label>
      <label><span>{domainLabel(t, "Assessment")}</span><LevelSelect value={v.assessmentGrant} onChange={set("assessmentGrant")} busy={busy} t={t} allowNone /></label>
      <label><span>{domainLabel(t, "Analytics")}</span><LevelSelect value={v.analyticsGrant} onChange={set("analyticsGrant")} busy={busy} t={t} allowNone /></label>
      <label><span>{domainLabel(t, "Branding")}</span><LevelSelect value={v.brandingGrant} onChange={set("brandingGrant")} busy={busy} t={t} allowNone /></label>
      <label><span>{t("admin.extraTutorCapacity")}</span><input type="number" min="0" value={v.extraTutorCapacity} onChange={set("extraTutorCapacity")} disabled={busy} /></label>
      <label><span>{t("admin.requiresDomain")}</span>
        <select value={v.requiresDomain} onChange={set("requiresDomain")} disabled={busy}>
          <option value="">{t("admin.none")}</option>
          {DOMAINS.map((d) => <option key={d} value={d}>{domainLabel(t, d)}</option>)}
        </select>
      </label>
      <label><span>{t("admin.requiresMinLevel")}</span><LevelSelect value={v.requiresMinLevel} onChange={set("requiresMinLevel")} busy={busy} t={t} allowNone /></label>
    </>
  );
}

function LevelSelect({ value, onChange, busy, t, allowNone }) {
  return (
    <select value={value} onChange={onChange} disabled={busy}>
      {allowNone && <option value="">{t("admin.none")}</option>}
      {LEVELS.map((lv) => <option key={lv} value={lv}>{levelLabel(t, lv)}</option>)}
    </select>
  );
}
