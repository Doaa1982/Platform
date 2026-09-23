import { useCallback, useEffect, useRef, useState } from "react";
import {
  LoaderCircle, AlertCircle, Check, Circle, Minus, ArrowRight, Globe, Lock,
  Sparkles, Image as ImageIcon, X,
} from "lucide-react";
import * as api from "../api/client";
import AssetImage from "../components/AssetImage";
import { useAssetUrl } from "../hooks/useAssetUrl";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import Notice from "../components/Notice";

/* =========================================================================
   WORKSPACE SETUP — the owner's own journey.

   Picks up where platform provisioning stops: the admin hands over a Workspace
   in Created and takes no further part (Platform Administrator Business
   Analysis §7). Everything from here to open-for-learners is the owner's.

   The server decides which single transition is available and returns it with
   every response, so this screen never re-derives the ordered lifecycle — it
   renders whatever the API says comes next (Workspace Setup Business
   Analysis, BA-004: the lifecycle is strictly ordered).
   ========================================================================= */

/** The five states an owner drives through, in order (Workspace Aggregate Design §15). */
const JOURNEY = [
  { status: "Created",     labelKey: "setup.journey0Label", blurbKey: "setup.journey0Blurb" },
  { status: "Configuring", labelKey: "setup.journey1Label", blurbKey: "setup.journey1Blurb" },
  { status: "Private",     labelKey: "setup.journey2Label", blurbKey: "setup.journey2Blurb" },
  { status: "Published",   labelKey: "setup.journey3Label", blurbKey: "setup.journey3Blurb" },
  { status: "Active",      labelKey: "setup.journey4Label", blurbKey: "setup.journey4Blurb" },
];

const ACTION_LABEL_KEY = {
  BeginConfiguration: "setup.actionBeginConfiguration",
  MakePrivate:        "setup.actionMakePrivate",
  Publish:            "setup.actionPublish",
  Activate:           "setup.actionActivate",
};

const ACTION_PATH = {
  BeginConfiguration: "begin-configuration",
  MakePrivate:        "make-private",
  Publish:            "publish",
  Activate:           "activate",
};

/** What each action actually does, so the owner isn't guessing before clicking. */
const ACTION_BLURB_KEY = {
  BeginConfiguration: "setup.blurbBeginConfiguration",
  MakePrivate:        "setup.blurbMakePrivate",
  Publish:            "setup.blurbPublish",
  Activate:           "setup.blurbActivate",
};

const ACTION_TOAST_KEY = {
  BeginConfiguration: "setup.toastBeginConfiguration",
  MakePrivate:        "setup.toastMakePrivate",
  Publish:            "setup.toastPublish",
  Activate:           "setup.toastActivate",
};

export default function WorkspaceSetupScreen() {
  const { session, workspace, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingBranding, setEditingBranding] = useState(false);

  const load = useCallback(
    () => api.getSetup(session.token, slug)
      .then((d) => { setSetup(d); setError(null); })
      .catch((e) => setError(e.message)),
    [session.token, slug]);

  useEffect(() => {
    let cancelled = false;
    api.getSetup(session.token, slug)
      .then((d) => { if (!cancelled) { setSetup(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  async function act(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await fn();
      if (next) setSetup(next);   // every endpoint returns the whole state
      if (successMessage) setSuccess(successMessage);

      /* The workspace name and slug the chrome renders were snapshotted at
         sign-in. Renaming here without this leaves the sidebar and account bar
         calling the workspace something the owner just stopped calling it. */
      await refreshProfile();
      return next;
    } catch (e) {
      setError(e.message);
      await load();               // resync after a rejected transition
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (error && !setup) {
    return <div className="lw-page"><Message type="error">{error}</Message></div>;
  }
  if (!setup) {
    return (
      <div className="lw-page">
        <div className="lw-setup__loading"><LoaderCircle size={18} className="lw-setup__spin" /> {t("setup.loading")}</div>
      </div>
    );
  }

  const currentIndex = JOURNEY.findIndex((s) => s.status === setup.status);
  const next = setup.nextTransition;

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{t("setup.eyebrow")}</div>
      <h1>{setup.name}</h1>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {/* ── Journey — hidden for now ────────────────────────────────────── */}

      {/* ── Readiness — INV-007, before Publish becomes available ────────── */}
      {currentIndex >= 0 && currentIndex < 3 && (
        <Readiness completeness={setup.completeness} hasBranding={!!(setup.logoAssetId || setup.welcomeMessage || setup.courseCategories.length > 0)} t={t} />
      )}

      {/* Suspended and Archived are platform-driven and sit outside the journey */}
      {currentIndex === -1 && (
        <Message type="error">{t("setup.statusAlert", { status: setup.status, blocker: setup.blocker })}</Message>
      )}

      {/* ── The one available action ────────────────────────────────────── */}
      {setup.canManage && next && (
        <div className="lw-setup__action">
          <div>
            <div className="lw-setup__actiontitle">{ACTION_LABEL_KEY[next] ? t(ACTION_LABEL_KEY[next]) : next}</div>
            <p>{t(ACTION_BLURB_KEY[next])}</p>
          </div>
          <button
            className="lw-btn lw-btn--accent"
            disabled={busy}
            onClick={() => act(() => api.workspaceTransition(session.token, slug, ACTION_PATH[next]), t(ACTION_TOAST_KEY[next]))}
          >
            {busy ? <LoaderCircle size={15} className="lw-setup__spin" /> : <>{t(ACTION_LABEL_KEY[next])} <ArrowRight size={15} /></>}
          </button>
        </div>
      )}

      {setup.canManage && !next && setup.blocker && (
        <div className="lw-setup__blocked"><AlertCircle size={15} /> {setup.blocker}</div>
      )}

      {/* "{name} is open. Learners can enrol." banner hidden for now. */}

      {/* ── Identity ────────────────────────────────────────────────────── */}
      <h2 className="lw-sectiontitle">{t("setup.identityTitle")}</h2>
      {editing ? (
        <IdentityForm
          setup={setup}
          busy={busy}
          session={session}
          slug={slug}
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            const saved = await act(() => api.updateWorkspaceIdentity(session.token, slug, body), t("setup.toastIdentitySaved"));
            if (saved) setEditing(false);
          }}
        />
      ) : (
        <div className="lw-setup__identity">
          <Field label={t("setup.nameLabel")} value={setup.name} />
          <Field label={t("setup.publicIdLabel")} value={`/${setup.slug}`} mono />
          <Field label={t("setup.descriptionLabel")} value={setup.description || t("setup.notSet")} muted={!setup.description} />
          {setup.canManage && (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setEditing(true)}>{t("setup.edit")}</button>
          )}
        </div>
      )}

      {/* Renaming after publication changes the address people already have */}
      {setup.status === "Published" || setup.status === "Active" ? (
        <p className="lw-setup__note">
          <Globe size={13} /> {t("setup.discoverablePrefix")} <code>/{setup.slug}</code>. {t("setup.discoverableSuffix")}
        </p>
      ) : (
        <p className="lw-setup__note">
          <Lock size={13} /> {t("setup.notDiscoverable")}
        </p>
      )}

      {/* Open to Join Requests moved to the Members screen's "Join Link" tab —
          it belongs to Student Access (Architecture doc §13), not identity/setup. */}

      {/* ── Branding — the public profile a Learner meets first ──────────── */}
      <h2 className="lw-sectiontitle">{t("setup.brandingTitle")}</h2>
      {editingBranding ? (
        <BrandingForm
          setup={setup}
          busy={busy}
          session={session}
          slug={slug}
          onCancel={() => setEditingBranding(false)}
          onSubmit={async (body) => {
            const saved = await act(() => api.updateWorkspaceBranding(session.token, slug, body), t("setup.toastBrandingSaved"));
            if (saved) setEditingBranding(false);
          }}
        />
      ) : (
        <div className="lw-setup__identity">
          <div className="lw-setup__brandingview">
            <div className={`lw-setup__logo ${setup.logoAssetId ? "" : "is-empty"}`}>
              {setup.logoAssetId
                ? <AssetImage token={session?.token} slug={slug} assetId={setup.logoAssetId} alt="" />
                : <ImageIcon size={20} />}
            </div>
            <div className="lw-setup__brandingfields">
              <Field label={t("setup.welcomeMessageLabel")} value={setup.welcomeMessage || t("setup.notSet")} muted={!setup.welcomeMessage} />
              <Field label={t("setup.courseCategoriesLabel")}
                     value={setup.courseCategories.length > 0 ? setup.courseCategories.join(", ") : t("setup.notSet")}
                     muted={setup.courseCategories.length === 0} />
            </div>
          </div>
          {setup.canManage && (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setEditingBranding(true)}>{t("setup.edit")}</button>
          )}
        </div>
      )}

      {!setup.canManage && <Notice tone="readonly">{t("setup.readonlyNote")}</Notice>}

      {/* "Not part of setup yet" notice hidden for now. */}
    </div>
  );
}

/**
 * The checklist Learning Workspace Experience Architecture §18 defines
 * (Blocking / Addressable / Suggested), computed from WorkspaceSetupResponse
 * .Completeness — the API already returns this on every GET, it just wasn't
 * surfaced anywhere until now. §18 is explicit that Suggested items never
 * read as errors, so "unavailable" items (nothing to toggle yet — TD-006)
 * get a muted dash and a "not built yet" badge rather than an empty circle
 * that would imply the Owner is failing to finish something they could.
 */
function Readiness({ completeness, hasBranding, t }) {
  if (!completeness) return null;

  const blocking = [
    { key: "name", done: completeness.hasName, label: t("setup.readinessName") },
    { key: "slug", done: completeness.hasPublicIdentifier, label: t("setup.readinessSlug") },
  ];
  const suggested = [
    { key: "description", status: completeness.hasDescription ? "done" : "pending", label: t("setup.readinessDescription"), badge: completeness.hasDescription ? null : t("setup.readinessOptional") },
    { key: "branding", status: hasBranding ? "done" : "pending", label: t("setup.readinessBranding"), badge: hasBranding ? null : t("setup.readinessOptional") },
    { key: "config", status: "unavailable", label: t("setup.readinessConfig"), badge: t("setup.readinessNotAvailable") },
    { key: "capabilities", status: "unavailable", label: t("setup.readinessCapabilities"), badge: t("setup.readinessNotAvailable") },
  ];
  const remaining = blocking.filter((it) => !it.done).length;

  return (
    <div className={`lw-setup__readiness ${completeness.readyToPublish ? "is-ready" : ""}`}>
      <div className="lw-setup__readinesshead">
        <span>{t("setup.readinessTitle")}</span>
        <span className="lw-setup__readinessstatus">
          {completeness.readyToPublish ? t("setup.readinessReady") : t("setup.readinessRemaining", { count: remaining })}
        </span>
      </div>

      <div className="lw-setup__readinessgroup">
        <span className="lw-setup__readinessgrouplabel">{t("setup.readinessBlockingTitle")}</span>
        <ul className="lw-setup__readinesslist">
          {blocking.map((it) => (
            <li key={it.key} className={it.done ? "is-done" : ""}>
              <span className="lw-setup__readinesscheck">{it.done ? <Check size={11} /> : <Circle size={7} />}</span>
              <span>{it.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {completeness.isAddressable && (
        <div className="lw-setup__readinessgroup">
          <span className="lw-setup__readinessgrouplabel">{t("setup.readinessAddressableTitle")}</span>
          <ul className="lw-setup__readinesslist">
            <li className="is-done">
              <span className="lw-setup__readinesscheck"><Check size={11} /></span>
              <span>{t("setup.readinessAddressable")}</span>
              <span className="lw-setup__readinessoptional">{t("setup.readinessAutomatic")}</span>
            </li>
          </ul>
        </div>
      )}

      <div className="lw-setup__readinessgroup">
        <span className="lw-setup__readinessgrouplabel">{t("setup.readinessSuggestedTitle")}</span>
        <ul className="lw-setup__readinesslist">
          {suggested.map((it) => (
            <li key={it.key} className={it.status === "done" ? "is-done" : it.status === "unavailable" ? "is-unavailable" : ""}>
              <span className="lw-setup__readinesscheck">
                {it.status === "done" ? <Check size={11} /> : it.status === "unavailable" ? <Minus size={11} /> : <Circle size={7} />}
              </span>
              <span>{it.label}</span>
              {it.badge && <span className="lw-setup__readinessoptional">{it.badge}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, value, mono, muted }) {
  return (
    <div className="lw-setup__field">
      <span className="lw-setup__fieldlabel">{label}</span>
      <span className={`lw-setup__fieldvalue ${mono ? "is-mono" : ""} ${muted ? "is-muted" : ""}`}>{value}</span>
    </div>
  );
}

function IdentityForm({ setup, onSubmit, onCancel, busy, session, slug: workspaceSlug }) {
  const { t } = useLanguage();
  const [name, setName] = useState(setup.name);
  const [slug, setSlug] = useState(setup.slug);
  const [description, setDescription] = useState(setup.description ?? "");

  // AI Capability Architecture §8 "Generate Description", scoped to the
  // Workspace's own profile (CapabilityDomain.Branding) — drafts from
  // whatever's typed so far.
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);

  async function suggestDescription() {
    if (!name.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const r = await api.suggestWorkspaceDescription(session.token, workspaceSlug, {
        name: name.trim(), courseCategories: setup.courseCategories,
      });
      setDescription(r.text);
    } catch (e) { setAiError(e.message); }
    finally { setAiBusy(false); }
  }

  // Changing the address after publication breaks any link people already
  // have to it (Workspace Setup Business Analysis §16, open question) — the
  // form doesn't forbid it, but it shouldn't happen by accident either.
  const isPublished = setup.status === "Published" || setup.status === "Active";
  const slugChanged = slug.trim() !== setup.slug;

  return (
    <form
      className="lw-setup__form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), slug: slug.trim(), description: description.trim() || null });
      }}
    >
      <label>
        <span>{t("setup.nameLabel")}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus disabled={busy} />
      </label>
      <label>
        <span>{t("setup.publicIdLabel")}</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          required disabled={busy}
        />
      </label>
      {isPublished && slugChanged && (
        <Notice tone="warning" style={{ gridColumn: "1 / -1" }}>{t("setup.slugChangeWarning", { old: setup.slug })}</Notice>
      )}
      <label className="lw-setup__wide">
        <span className="lw-setup__desclabel">
          {t("setup.descriptionLabel")}
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={suggestDescription}
                  disabled={busy || aiBusy || !name.trim()} title={t("setup.aiSuggestDescription")}>
            {aiBusy
              ? <LoaderCircle size={12} className="lw-setup__spin" />
              : <Sparkles size={12} />} {t("setup.aiSuggestDescription")}
          </button>
        </span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
        {aiError && <Message type="error">{aiError}</Message>}
      </label>
      <div className="lw-setup__formactions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy}>{t("setup.cancel")}</button>
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !name.trim() || !slug.trim()}>
          {busy ? <LoaderCircle size={14} className="lw-setup__spin" /> : t("setup.save")}
        </button>
      </div>
    </form>
  );
}

function BrandingForm({ setup, onSubmit, onCancel, busy, session, slug }) {
  const { t } = useLanguage();
  const [welcomeMessage, setWelcomeMessage] = useState(setup.welcomeMessage ?? "");
  const [categories, setCategories] = useState(setup.courseCategories.join(", "));
  const [logoAssetId, setLogoAssetId] = useState(setup.logoAssetId ?? null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const logoInputRef = useRef(null);

  const logoAccess = useAssetUrl(session?.token, slug, logoAssetId && !logoFile ? logoAssetId : null);
  const logoPreviewSrc = logoPreviewUrl || logoAccess.url;

  function handleLogoChange(file) {
    if (!file) return;
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  }

  function handleClearLogo() {
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setLogoAssetId(null);
  }

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // AI Capability Architecture §8 "Generate Description", applied to the
  // welcome message this time — drafts from name, description and categories
  // already typed elsewhere on this screen.
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);

  async function suggestWelcome() {
    setAiBusy(true);
    setAiError(null);
    try {
      const r = await api.suggestWorkspaceWelcome(session.token, slug, {
        name: setup.name, description: setup.description,
        courseCategories: categories.split(",").map((c) => c.trim()).filter(Boolean),
      });
      setWelcomeMessage(r.text);
    } catch (e) { setAiError(e.message); }
    finally { setAiBusy(false); }
  }

  return (
    <form
      className="lw-setup__form"
      onSubmit={async (e) => {
        e.preventDefault();
        setUploadError(null);
        let assetId = logoAssetId;
        if (logoFile) {
          setUploading(true);
          try {
            const asset = await api.uploadLearningAsset(session.token, slug, logoFile, setup.name, undefined, "Image");
            assetId = asset.id;
          } catch (err) { setUploadError(err.message); setUploading(false); return; }
          setUploading(false);
        }
        onSubmit({
          logoAssetId: assetId,
          welcomeMessage: welcomeMessage.trim() || null,
          courseCategories: categories.split(",").map((c) => c.trim()).filter(Boolean),
        });
      }}
    >
      <label>
        <span>{t("setup.photoLabel")}</span>
        <div className="lw-setup__logoupload">
          {logoPreviewSrc && <img className="lw-setup__logopreview" src={logoPreviewSrc} alt="" />}
          <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                 onChange={(e) => handleLogoChange(e.target.files?.[0])} />
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy || uploading}
                  onClick={() => logoInputRef.current?.click()}>
            <ImageIcon size={12} /> {logoPreviewSrc ? t("setup.changePhoto") : t("setup.choosePhoto")}
          </button>
          {logoPreviewSrc && (
            <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy || uploading} onClick={handleClearLogo}>
              <X size={12} /> {t("setup.removePhoto")}
            </button>
          )}
        </div>
        {uploadError && <Message type="error">{uploadError}</Message>}
      </label>
      <label className="lw-setup__wide">
        <span className="lw-setup__desclabel">
          {t("setup.welcomeMessageLabel")}
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={suggestWelcome}
                  disabled={busy || aiBusy || !setup.name.trim()} title={t("setup.aiSuggestWelcome")}>
            {aiBusy
              ? <LoaderCircle size={12} className="lw-setup__spin" />
              : <Sparkles size={12} />} {t("setup.aiSuggestWelcome")}
          </button>
        </span>
        <textarea rows={2} value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder={t("setup.welcomeMessagePlaceholder")} disabled={busy} />
        {aiError && <Message type="error">{aiError}</Message>}
      </label>
      <label>
        <span>{t("setup.courseCategoriesLabel")} <em>{t("setup.courseCategoriesHint")}</em></span>
        <input value={categories} onChange={(e) => setCategories(e.target.value)}
               placeholder={t("setup.courseCategoriesPlaceholder")} disabled={busy} />
      </label>
      <div className="lw-setup__formactions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy || uploading}>{t("setup.cancel")}</button>
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || uploading}>
          {busy || uploading ? <LoaderCircle size={14} className="lw-setup__spin" /> : t("setup.save")}
        </button>
      </div>
    </form>
  );
}

const CSS = `
  .lw-setup__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }

  .lw-setup__journey { list-style: none; padding: 0; margin: 0 0 24px; }
  .lw-setup__step { display: flex; gap: 12px; padding: 0 0 16px; position: relative; }
  .lw-setup__step:not(:last-child)::before {
    content: ""; position: absolute; inset-inline-start: 10px; top: 22px; bottom: 2px;
    width: 1px; background: var(--line);
  }
  .lw-setup__step.is-done::before { background: var(--accent-2); }
  .lw-setup__dot {
    width: 21px; height: 21px; border-radius: 50%; flex-shrink: 0; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface); border: 1px solid var(--line); color: var(--ink-soft);
  }
  .lw-setup__step.is-done .lw-setup__dot { background: var(--accent-2); border-color: var(--accent-2); color: #fff; }
  .lw-setup__step.is-current .lw-setup__dot { background: var(--accent); border-color: var(--accent); color: #fff; }
  .lw-setup__steplabel { display: block; font-weight: 600; font-size: 0.9rem; }
  .lw-setup__step.is-todo .lw-setup__steplabel { color: var(--ink-soft); }
  .lw-setup__stepblurb { display: block; font-size: 0.8rem; color: var(--ink-soft); margin-top: 2px; }

  .lw-setup__readiness {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 14px 18px; margin-bottom: 16px;
  }
  .lw-setup__readiness.is-ready { border-color: color-mix(in srgb, var(--accent-2) 35%, transparent); }
  .lw-setup__readinesshead {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    font-size: 0.78rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: var(--ink-soft);
  }
  .lw-setup__readinessstatus { text-transform: none; letter-spacing: normal; font-weight: 600; }
  .lw-setup__readiness.is-ready .lw-setup__readinessstatus { color: var(--accent-2); }
  .lw-setup__readinessgroup { margin-top: 14px; }
  .lw-setup__readinessgrouplabel { font-size: 0.72rem; font-weight: 600; color: var(--ink-soft); }
  .lw-setup__readinesslist { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 8px; }
  .lw-setup__readinesslist li { display: flex; align-items: center; gap: 9px; font-size: 0.85rem; color: var(--ink-soft); }
  .lw-setup__readinesslist li.is-done { color: var(--ink); }
  /* Suggested items with nothing to toggle yet (TD-006) — a dash, not an
     empty circle, and never red: §18's Presentation Principle reserves
     blocking/error language for the Blocking group alone. */
  .lw-setup__readinesslist li.is-unavailable { opacity: 0.7; }
  .lw-setup__readinesscheck {
    width: 17px; height: 17px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-soft);
  }
  .lw-setup__readinesslist li.is-done .lw-setup__readinesscheck { background: var(--accent-2); border-color: var(--accent-2); color: #fff; }
  .lw-setup__readinessoptional {
    font-size: 0.72rem; color: var(--ink-soft); background: var(--surface-2);
    border-radius: 999px; padding: 1px 8px;
  }

  .lw-setup__action {
    display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: var(--radius-sm); padding: 16px 18px; margin-bottom: 8px;
  }
  .lw-setup__actiontitle { font-weight: 600; font-size: 0.95rem; }
  .lw-setup__action p { font-size: 0.83rem; color: var(--ink-soft); margin: 4px 0 0; max-width: 58ch; line-height: 1.55; }

  .lw-setup__blocked, .lw-setup__done {
    display: flex; align-items: center; gap: 9px; font-size: 0.87rem;
    border-radius: var(--radius-sm); padding: 12px 15px; margin-bottom: 8px;
  }
  .lw-setup__blocked { background: color-mix(in srgb, var(--danger) 8%, transparent); color: var(--danger); }
  .lw-setup__done { background: color-mix(in srgb, var(--accent-2) 12%, transparent); color: var(--accent-2); font-weight: 600; }

  .lw-setup__identity {
    display: flex; flex-direction: column; gap: 12px; align-items: flex-start;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 16px 18px;
  }
  .lw-setup__field { display: flex; gap: 14px; align-items: baseline; width: 100%; }
  .lw-setup__fieldlabel { font-size: 0.78rem; color: var(--ink-soft); min-width: 130px; flex-shrink: 0; }
  .lw-setup__fieldvalue { font-size: 0.92rem; }
  .lw-setup__fieldvalue.is-mono { font-family: var(--font-mono); font-size: 0.85rem; }
  .lw-setup__fieldvalue.is-muted { color: var(--ink-soft); font-style: italic; }

  .lw-setup__brandingview { display: flex; gap: 16px; align-items: flex-start; width: 100%; }
  .lw-setup__brandingfields { flex: 1; display: flex; flex-direction: column; gap: 12px; }
  .lw-setup__logo {
    width: 56px; height: 56px; border-radius: 10px; flex-shrink: 0; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-soft);
  }
  .lw-setup__logo img { width: 100%; height: 100%; object-fit: cover; }
  .lw-setup__logoupload { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .lw-setup__logopreview { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 1px solid var(--line); flex-shrink: 0; }
  .lw-setup__desclabel { display: flex !important; align-items: center; gap: 8px; white-space: normal !important; }
  .lw-btn--xs { font-size: 0.72rem; padding: 3px 8px; gap: 4px; }

  /* UIC-003: one property per row — label left, value right — matching
     .lw-setup__field's own read-only row layout above. */
  .lw-setup__form {
    display: grid; grid-template-columns: max-content 1fr; row-gap: 14px; column-gap: 16px; align-items: start;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 16px 18px;
  }
  .lw-setup__form > label { display: contents; }
  .lw-setup__form label > span:first-child { font-size: 0.78rem; font-weight: 600; padding-top: 9px; white-space: nowrap; }
  .lw-setup__form input, .lw-setup__form textarea {
    width: 100%; font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 9px 11px; resize: vertical;
  }
  .lw-setup__formactions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }
  @media (max-width: 560px) {
    .lw-setup__form { grid-template-columns: 1fr; }
    .lw-setup__form > label { display: flex; flex-direction: column; gap: 5px; }
    .lw-setup__form label > span:first-child { padding-top: 0; white-space: normal; }
  }

  .lw-setup__note {
    display: flex; align-items: center; gap: 7px;
    font-size: 0.8rem; color: var(--ink-soft); margin-top: 12px;
  }
  .lw-setup__note code { font-family: var(--font-mono); }

  .lw-setup__notyet {
    background: var(--surface-2); border-radius: var(--radius-sm);
    padding: 15px 17px; margin-top: 26px;
  }
  .lw-setup__notyet strong {
    display: block; font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 7px;
  }
  .lw-setup__notyet p { font-size: 0.85rem; color: var(--ink-soft); margin: 0; line-height: 1.6; max-width: 66ch; }

  .lw-setup__spin { animation: lwSetupSpin 0.9s linear infinite; }
  @keyframes lwSetupSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-setup__spin { animation: none; } }
`;
