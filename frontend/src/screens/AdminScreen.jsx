import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle, Plus, RefreshCw, X, Copy, Check,
  ShieldAlert, LogOut, Building2, PauseCircle, PlayCircle, Archive, Clock, Receipt, UserPlus,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import AdminCatalogSection from "./AdminCatalogSection";
import Message from "../components/Message";
import PaginationControls, { PAGINATION_CONTROLS_CSS } from "../components/PaginationControls";
import { usePagination } from "../hooks/usePagination";

/* =========================================================================
   ADMIN SCREEN — the Platform Administrator's console.

   The only surface in the app that is not Workspace-scoped. Its authority
   comes from a PlatformOperator grant, never from a Membership, so it can act
   on Workspaces it belongs to in no way at all (Platform Administrator
   Business Analysis, BA-001).

   The UI never decides who is an admin. Every call goes to the server, and a
   403 is rendered honestly as "you don't have access" rather than the surface
   being hidden client-side — hiding a button is not authorization.
   ========================================================================= */

/** Provisioning statuses where the admin has outstanding work (§9). */
const NEEDS_ACTION = new Set(["Awaiting Invitation", "Invitation Expired"]);

/** Application statuses still waiting on a reviewer's decision (§7.1). */
const AWAITING = new Set(["Submitted", "UnderReview"]);

function humanStatus(status) {
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Subscription statuses needing operator attention (§9's ordering convention, applied to the commercial domain too). */
const SUB_NEEDS_ACTION = new Set(["PastDue", "Grace", "Suspended"]);

const SUB_STATUS_KEY = {
  Pending: "subscription.statusPending", Active: "subscription.statusActive", PastDue: "subscription.statusPastDue",
  Grace: "subscription.statusGrace", Suspended: "subscription.statusSuspended",
  Cancelled: "subscription.statusCancelled", Expired: "subscription.statusExpired",
};
const subStatusLabel = (t, s) => t(SUB_STATUS_KEY[s] ?? "") || s;

const INVOICE_STATUS_KEY = {
  Draft: "admin.invoiceDraft", Issued: "admin.invoiceIssued", Paid: "admin.invoicePaid",
  Overdue: "admin.invoiceOverdue", Voided: "admin.invoiceVoided",
};
const invoiceStatusLabel = (t, s) => t(INVOICE_STATUS_KEY[s] ?? "") || s;

export default function AdminScreen() {
  useFonts();
  const { session, me, signOut } = useAuth();
  const { t } = useLanguage();

  const [rows, setRows] = useState(null);
  const [applications, setApplications] = useState([]);
  const [subscriptions, setSubscriptions] = useState(null);
  const [invoiceNotes, setInvoiceNotes] = useState({});   // subscriptionId -> reference note text, for Mark Paid
  const [creditPurchases, setCreditPurchases] = useState(null);
  const [creditPurchaseNotes, setCreditPurchaseNotes] = useState({});   // orderId -> reference note text
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [provisionFor, setProvisionFor] = useState(null);  // the paid applicant being provisioned
  const [issued, setIssued] = useState(null);   // most recently created/resent link
  const [tab, setTab] = useState("applications");  // "applications" | "invitations" | "subscriptions" | "creditPurchases" | "catalog"

  // Declared unconditionally, before the `denied` early return below — Rules
  // of Hooks — even though their data only ever renders past that guard.
  const applicationsPage = usePagination(applications);
  const workspacesPage = usePagination(rows);
  const subscriptionsPage = usePagination(subscriptions);
  const creditPurchasesPage = usePagination(creditPurchases);

  /* Used by the refresh button and after every mutation. State lands in the
     promise callbacks, never synchronously. */
  const load = useCallback(
    () => Promise.all([
      api.getProvisioningView(session.token),
      api.getSignupRequests(session.token),
      api.getAdminSubscriptions(session.token),
      api.getAdminCreditPurchases(session.token),
    ])
      .then(([workspaces, signups, subs, purchases]) => {
        setRows(workspaces); setApplications(signups); setSubscriptions(subs); setCreditPurchases(purchases); setError(null);
      })
      .catch((e) => {
        // 403 is not an error to retry — it is the answer. The account is
        // signed in but holds no PlatformOperator grant.
        if (e.status === 403) setDenied(true);
        else setError(e.message);
      }),
    [session.token]);

  // Initial load, inlined rather than calling load(), so nothing sets state
  // synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.getProvisioningView(session.token),
      api.getSignupRequests(session.token),
      api.getAdminSubscriptions(session.token),
      api.getAdminCreditPurchases(session.token),
    ])
      .then(([workspaces, signups, subs, purchases]) => {
        if (cancelled) return;
        setRows(workspaces); setApplications(signups); setSubscriptions(subs); setCreditPurchases(purchases); setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.status === 403) setDenied(true);
        else setError(e.message);
      });

    return () => { cancelled = true; };
  }, [session.token]);

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fn();
      if (successMessage) setSuccess(successMessage);
      await load();
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (denied) {
    return (
      <Shell>
        <div className="pl-admin__denied">
          <ShieldAlert size={28} aria-hidden="true" />
          <h1>{t("admin.notAdminTitle")}</h1>
          <p>{t("admin.notAdminBody", { email: me?.email })}</p>
          <button className="pl-admin__btn" onClick={signOut}>{t("admin.signOut")}</button>
        </div>
      </Shell>
    );
  }

  // Splitting Operations into tabs hides whatever isn't the active one, so a
  // small count on the tab label is what used to be "just visible on the
  // page" — applications awaiting review, workspaces stuck on invitation,
  // subscriptions needing back-office action (past due/grace/suspended, or
  // an invoice/pending-change awaiting confirmation).
  const applicationsAttentionCount = applications?.filter((a) => AWAITING.has(a.status)).length ?? 0;
  const invitationsAttentionCount = rows?.filter((r) => NEEDS_ACTION.has(r.provisioningStatus)).length ?? 0;
  const subscriptionsAttentionCount = subscriptions?.filter((s) =>
    SUB_NEEDS_ACTION.has(s.status) || s.currentInvoiceStatus === "Issued" || s.currentInvoiceStatus === "Overdue" || s.pendingPlanCode
  ).length ?? 0;

  return (
    <Shell>
      <header className="pl-admin__head">
        <div className="pl-admin__headtitle">
          <div className="pl-admin__eyebrow">{t("admin.eyebrow")}</div>
          <h1>{t("admin.workspaces")}</h1>
        </div>
        <div className="pl-admin__headactions">
          <button className="pl-admin__ghost" onClick={load} disabled={busy}>
            <RefreshCw size={14} aria-hidden="true" /> {t("admin.refresh")}
          </button>
          <button className="pl-admin__btn" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} aria-hidden="true" /> {t("admin.provisionWorkspace")}
          </button>
          <button className="pl-admin__ghost" onClick={signOut}>
            <LogOut size={14} aria-hidden="true" /> {t("admin.signOut")}
          </button>
        </div>
      </header>

      <div className="pl-admin__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "applications"}
                className={tab === "applications" ? "is-active" : ""} onClick={() => setTab("applications")}>
          {t("admin.tabApplications")}
          {applicationsAttentionCount > 0 && <span className="pl-admin__tabbadge">{applicationsAttentionCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "invitations"}
                className={tab === "invitations" ? "is-active" : ""} onClick={() => setTab("invitations")}>
          {t("admin.tabInvitations")}
          {invitationsAttentionCount > 0 && <span className="pl-admin__tabbadge">{invitationsAttentionCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "subscriptions"}
                className={tab === "subscriptions" ? "is-active" : ""} onClick={() => setTab("subscriptions")}>
          {t("admin.subscriptions")}
          {subscriptionsAttentionCount > 0 && <span className="pl-admin__tabbadge">{subscriptionsAttentionCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "creditPurchases"}
                className={tab === "creditPurchases" ? "is-active" : ""} onClick={() => setTab("creditPurchases")}>
          {t("admin.creditPurchases")}
          {creditPurchases?.length > 0 && <span className="pl-admin__tabbadge">{creditPurchases.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "catalog"}
                className={tab === "catalog" ? "is-active" : ""} onClick={() => setTab("catalog")}>
          {t("admin.tabCatalog")}
        </button>
      </div>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {tab === "catalog" && <AdminCatalogSection />}

      {/* Both triggered from the always-visible header button/Applications-tab
          buttons, so rendered unconditionally rather than gated to one tab —
          a modal opened from one tab shouldn't vanish just because it isn't
          the active one. */}
      {showForm && (
        <ProvisionForm
          busy={busy}
          onCancel={() => setShowForm(false)}
          onSubmit={async (body) => {
            const result = await run(() => api.provisionWorkspace(session.token, body));
            if (result) { setIssued(result); setShowForm(false); }
          }}
        />
      )}

      {issued && <IssuedLink issued={issued} onDismiss={() => setIssued(null)} />}

      {/* §7.1 — applications, which come before any workspace exists. Own tab
          because it's the platform's oldest outstanding work: nothing else
          can happen for that person until it's decided, and reviewing it is
          a distinct concern from tracking a workspace's own invitation. */}
      {tab === "applications" && applications.length === 0 && (
        <div className="pl-admin__empty">
          <UserPlus size={26} aria-hidden="true" />
          <p>{t("admin.noApplicationsYet")}</p>
        </div>
      )}

      {tab === "applications" && applications.length > 0 && (
        <section className="pl-admin__apps">
          <h2 className="pl-admin__h2">{t("admin.tutorApplications")}</h2>
          <div className="pl-admin__applist">
            {applicationsPage.pageItems.map((a) => (
              <div key={a.id} className={`pl-admin__app ${AWAITING.has(a.status) ? "is-attention" : ""}`}>
                <div className="pl-admin__appwho">
                  <strong>{a.fullName}</strong>
                  <span>{a.email}</span>
                  {a.about && <p>{a.about}</p>}
                </div>
                <div className="pl-admin__appstate">
                  <span className={`pl-admin__pill ${AWAITING.has(a.status) ? "is-warn" : a.status === "Approved" ? "is-ok" : ""}`}>
                    {humanStatus(a.status)}
                  </span>
                </div>
                <div className="pl-admin__actions">
                  {AWAITING.has(a.status) && (
                    <>
                      <button disabled={busy} onClick={() => run(() => api.approveSignup(session.token, a.id), t("admin.toastApplicationApproved", { name: a.fullName }))}>
                        <Check size={12} /> {t("admin.approve")}
                      </button>
                      <button disabled={busy}
                              onClick={() => run(() => api.rejectSignup(session.token, a.id, { reason: null, reasonVisible: false }), t("admin.toastApplicationRejected", { name: a.fullName }))}>
                        <X size={12} /> {t("admin.reject")}
                      </button>
                    </>
                  )}
                  {/* Approved but not yet provisioned — §7.2 stays admin-initiated (BA-004) */}
                  {a.status === "Approved" && !a.provisionedWorkspaceId && (
                    <button disabled={busy} onClick={() => setProvisionFor(a)}>
                      <Plus size={12} /> {t("admin.provisionWorkspace")}
                    </button>
                  )}
                  {a.provisionedWorkspaceId && <span className="pl-admin__muted">{t("admin.provisioned")}</span>}
                </div>
              </div>
            ))}
          </div>
          <PaginationControls page={applicationsPage.page} totalPages={applicationsPage.totalPages} onChange={applicationsPage.setPage} />
        </section>
      )}

      {provisionFor && (
        <ProvisionForm
          busy={busy}
          applicant={provisionFor}
          onCancel={() => setProvisionFor(null)}
          onSubmit={async (body) => {
            const result = await run(() => api.provisionForSignup(session.token, provisionFor.id, body));
            if (result) { setIssued(result); setProvisionFor(null); }
          }}
        />
      )}

      {tab === "invitations" && rows === null && (
        <div className="pl-admin__loading">
          <LoaderCircle size={20} className="pl-admin__spin" aria-hidden="true" /> {t("admin.loadingWorkspaces")}
        </div>
      )}

      {tab === "invitations" && rows?.length === 0 && (
        <div className="pl-admin__empty">
          <Building2 size={26} aria-hidden="true" />
          <p>{t("admin.noWorkspacesYet")}</p>
        </div>
      )}

      {tab === "invitations" && rows && rows.length > 0 && (
        <div className="pl-admin__tablewrap">
          <table className="pl-admin__table">
            <thead>
              <tr>
                <th>{t("admin.colWorkspace")}</th>
                <th>{t("admin.colLifecycle")}</th>
                <th>{t("admin.colProvisioning")}</th>
                <th>{t("admin.colMembers")}</th>
                <th>{t("admin.colInvitation")}</th>
                <th aria-label={t("admin.colActions")} />
              </tr>
            </thead>
            <tbody>
              {workspacesPage.pageItems.map((r) => (
                <tr key={r.workspaceId} className={NEEDS_ACTION.has(r.provisioningStatus) ? "is-attention" : ""}>
                  <td>
                    <span className="pl-admin__wsname">{r.name}</span>
                    <span className="pl-admin__slug">/{r.slug}</span>
                  </td>
                  <td><span className="pl-admin__pill">{r.workspaceStatus}</span></td>
                  <td>
                    <span className={`pl-admin__pill ${NEEDS_ACTION.has(r.provisioningStatus) ? "is-warn" : "is-ok"}`}>
                      {r.provisioningStatus}
                    </span>
                  </td>
                  <td>{r.memberCount}</td>
                  <td>
                    {r.invitation ? (
                      <span className="pl-admin__inv">
                        {r.invitation.email}
                        <span className="pl-admin__invmeta">
                          {r.invitation.intendedRole} · {r.invitation.status}
                        </span>
                      </span>
                    ) : <span className="pl-admin__muted">—</span>}
                  </td>
                  <td className="pl-admin__actions">
                    {r.invitation && ["Sent", "Expired"].includes(r.invitation.status) && (
                      <>
                        <button
                          disabled={busy}
                          onClick={async () => {
                            const res = await run(() => api.resendInvitation(session.token, r.invitation.id));
                            if (res) setIssued(res);
                          }}
                        >
                          <RefreshCw size={12} aria-hidden="true" /> {t("admin.resend")}
                        </button>
                        {r.invitation.status === "Sent" && (
                          <button
                            disabled={busy}
                            onClick={() => run(() => api.cancelInvitation(session.token, r.invitation.id), t("admin.toastInvitationCancelled"))}
                          >
                            <X size={12} aria-hidden="true" /> {t("admin.cancel")}
                          </button>
                        )}
                      </>
                    )}
                    {r.workspaceStatus === "Active" && (
                      <button disabled={busy} onClick={() => run(() => api.workspaceAction(session.token, r.workspaceId, "suspend"), t("admin.toastWorkspaceSuspended", { name: r.name }))}>
                        <PauseCircle size={12} aria-hidden="true" /> {t("admin.suspend")}
                      </button>
                    )}
                    {r.workspaceStatus === "Suspended" && (
                      <button disabled={busy} onClick={() => run(() => api.workspaceAction(session.token, r.workspaceId, "reinstate"), t("admin.toastWorkspaceReinstated", { name: r.name }))}>
                        <PlayCircle size={12} aria-hidden="true" /> {t("admin.reinstate")}
                      </button>
                    )}
                    {!["Archived", "Deleted"].includes(r.workspaceStatus) && (
                      <button disabled={busy} onClick={() => run(() => api.workspaceAction(session.token, r.workspaceId, "archive"), t("admin.toastWorkspaceArchived", { name: r.name }))}>
                        <Archive size={12} aria-hidden="true" /> {t("admin.archive")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "invitations" && (
        <PaginationControls page={workspacesPage.page} totalPages={workspacesPage.totalPages} onChange={workspacesPage.setPage} />
      )}

      {/* Manual Commercial Activation (2026-08-09 correction: this platform
          collects no payment) — every Workspace's commercial state, and the
          back-office actions that stand in for a payment provider's webhook. */}
      {tab === "subscriptions" && (
      <section className="pl-admin__subs">
        <div className="pl-admin__subshead">
          <h2 className="pl-admin__h2">{t("admin.subscriptions")}</h2>
          <button className="pl-admin__ghost" disabled={busy} onClick={() => run(() => api.sweepOverdueInvoices(session.token), t("admin.toastOverdueSwept"))}>
            <RefreshCw size={14} aria-hidden="true" /> {t("admin.sweepOverdue")}
          </button>
        </div>

        {subscriptions === null && (
          <div className="pl-admin__loading">
            <LoaderCircle size={20} className="pl-admin__spin" aria-hidden="true" /> {t("admin.loadingSubscriptions")}
          </div>
        )}

        {subscriptions?.length === 0 && (
          <div className="pl-admin__empty">
            <Receipt size={26} aria-hidden="true" />
            <p>{t("admin.noSubscriptionsYet")}</p>
          </div>
        )}

        {subscriptions && subscriptions.length > 0 && (
          <div className="pl-admin__tablewrap">
            <table className="pl-admin__table">
              <thead>
                <tr>
                  <th>{t("admin.colWorkspace")}</th>
                  <th>{t("admin.colPlan")}</th>
                  <th>{t("admin.colStatus")}</th>
                  <th>{t("admin.colInvoice")}</th>
                  <th aria-label={t("admin.colActions")} />
                </tr>
              </thead>
              <tbody>
                {subscriptionsPage.pageItems.map((s) => (
                  <tr key={s.subscriptionId} className={SUB_NEEDS_ACTION.has(s.status) ? "is-attention" : ""}>
                    <td>
                      <span className="pl-admin__wsname">{s.workspaceName}</span>
                      <span className="pl-admin__slug">/{s.workspaceSlug}</span>
                    </td>
                    <td>
                      {s.planCode}
                      {s.pendingPlanCode && (
                        <span className="pl-admin__pendingchange">
                          {t("admin.pendingChangeTo", { plan: s.pendingPlanCode, date: s.pendingChangeEffectiveDate ? new Date(s.pendingChangeEffectiveDate).toLocaleDateString() : "" })}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`pl-admin__pill ${s.status === "Active" ? "is-ok"
                        : s.status === "Suspended" ? "is-danger"
                        : SUB_NEEDS_ACTION.has(s.status) ? "is-warn" : ""}`}>
                        {subStatusLabel(t, s.status)}
                      </span>
                    </td>
                    <td>
                      {s.currentInvoiceId ? (
                        <span className="pl-admin__inv">
                          <span className={`pl-admin__pill ${s.currentInvoiceStatus === "Overdue" ? "is-danger" : s.currentInvoiceStatus === "Paid" ? "is-ok" : ""}`}>
                            {invoiceStatusLabel(t, s.currentInvoiceStatus)}
                          </span>
                          <span className="pl-admin__invmeta">
                            {s.currentInvoiceTotal} · {s.currentInvoiceDueDate ? new Date(s.currentInvoiceDueDate).toLocaleDateString() : ""}
                          </span>
                        </span>
                      ) : <span className="pl-admin__muted">{t("admin.noInvoice")}</span>}
                    </td>
                    <td className="pl-admin__actions">
                      {(s.currentInvoiceStatus === "Issued" || s.currentInvoiceStatus === "Overdue") && (
                        <>
                          <input
                            className="pl-admin__noteinput"
                            placeholder={t("admin.referenceNotePlaceholder")}
                            value={invoiceNotes[s.subscriptionId] ?? ""}
                            disabled={busy}
                            onChange={(e) => setInvoiceNotes((n) => ({ ...n, [s.subscriptionId]: e.target.value }))}
                          />
                          <button disabled={busy}
                                  onClick={() => run(() => api.markInvoicePaid(session.token, s.currentInvoiceId, invoiceNotes[s.subscriptionId] || null), t("admin.toastInvoicePaid", { name: s.workspaceName }))}>
                            <Check size={12} aria-hidden="true" /> {t("admin.markPaid")}
                          </button>
                          <button disabled={busy}
                                  onClick={() => run(() => api.voidInvoice(session.token, s.currentInvoiceId, invoiceNotes[s.subscriptionId] || null), t("admin.toastInvoiceVoided", { name: s.workspaceName }))}>
                            <X size={12} aria-hidden="true" /> {t("admin.voidInvoice")}
                          </button>
                        </>
                      )}
                      {s.status === "PastDue" && (
                        <button disabled={busy} onClick={() => run(() => api.subscriptionAdminAction(session.token, s.subscriptionId, "advance-to-grace"), t("admin.toastSubscriptionGrace", { name: s.workspaceName }))}>
                          <Clock size={12} aria-hidden="true" /> {t("admin.advanceToGrace")}
                        </button>
                      )}
                      {s.status === "Grace" && (
                        <button disabled={busy} onClick={() => run(() => api.subscriptionAdminAction(session.token, s.subscriptionId, "suspend"), t("admin.toastSubscriptionSuspended", { name: s.workspaceName }))}>
                          <PauseCircle size={12} aria-hidden="true" /> {t("admin.suspend")}
                        </button>
                      )}
                      {s.status === "Suspended" && (
                        <>
                          <button disabled={busy} onClick={() => run(() => api.subscriptionAdminAction(session.token, s.subscriptionId, "expire"), t("admin.toastSubscriptionExpired", { name: s.workspaceName }))}>
                            <Archive size={12} aria-hidden="true" /> {t("admin.expire")}
                          </button>
                          <span className="pl-admin__muted pl-admin__terminalnote">{t("admin.suspendedTerminalNote")}</span>
                        </>
                      )}
                      {s.pendingPlanCode && (
                        <button disabled={busy} onClick={() => run(() => api.subscriptionAdminAction(session.token, s.subscriptionId, "apply-pending-change"), t("admin.toastPendingChangeApplied", { name: s.workspaceName }))}>
                          <Check size={12} aria-hidden="true" /> {t("admin.applyPendingChange")}
                        </button>
                      )}
                      <button disabled={busy} title={t("admin.recomputeEntitlementsHint")}
                              onClick={() => run(() => api.subscriptionAdminAction(session.token, s.subscriptionId, "recompute-entitlements"), t("admin.toastEntitlementsRecomputed", { name: s.workspaceName }))}>
                        <RefreshCw size={12} aria-hidden="true" /> {t("admin.recomputeEntitlements")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls page={subscriptionsPage.page} totalPages={subscriptionsPage.totalPages} onChange={subscriptionsPage.setPage} />
      </section>
      )}

      {/* AI-credit top-up requests — same Manual Commercial Activation pattern as invoices above, just for a one-time, subscription-independent purchase. */}
      {tab === "creditPurchases" && (
      <section className="pl-admin__subs">
        <div className="pl-admin__subshead">
          <h2 className="pl-admin__h2">{t("admin.creditPurchases")}</h2>
        </div>

        {creditPurchases === null && (
          <div className="pl-admin__loading">
            <LoaderCircle size={20} className="pl-admin__spin" aria-hidden="true" /> {t("admin.loadingCreditPurchases")}
          </div>
        )}

        {creditPurchases?.length === 0 && (
          <div className="pl-admin__empty">
            <Receipt size={26} aria-hidden="true" />
            <p>{t("admin.noCreditPurchasesPending")}</p>
          </div>
        )}

        {creditPurchases && creditPurchases.length > 0 && (
          <div className="pl-admin__tablewrap">
            <table className="pl-admin__table">
              <thead>
                <tr>
                  <th>{t("admin.colWorkspace")}</th>
                  <th>{t("admin.colCreditPack")}</th>
                  <th>{t("admin.colAmount")}</th>
                  <th aria-label={t("admin.colActions")} />
                </tr>
              </thead>
              <tbody>
                {creditPurchasesPage.pageItems.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="pl-admin__wsname">{o.workspaceName}</span>
                      <span className="pl-admin__slug">/{o.workspaceSlug}</span>
                    </td>
                    <td>{o.creditPackName}</td>
                    <td>{o.priceAmount} {o.priceCurrency}</td>
                    <td className="pl-admin__actions">
                      <input
                        className="pl-admin__noteinput"
                        placeholder={t("admin.referenceNotePlaceholder")}
                        value={creditPurchaseNotes[o.id] ?? ""}
                        disabled={busy}
                        onChange={(e) => setCreditPurchaseNotes((n) => ({ ...n, [o.id]: e.target.value }))}
                      />
                      <button disabled={busy}
                              onClick={() => run(() => api.markCreditPurchasePaid(session.token, o.id, creditPurchaseNotes[o.id] || null), t("admin.toastPurchaseApproved", { name: o.workspaceName }))}>
                        <Check size={12} aria-hidden="true" /> {t("admin.approvePurchase")}
                      </button>
                      <button disabled={busy}
                              onClick={() => run(() => api.voidCreditPurchase(session.token, o.id, creditPurchaseNotes[o.id] || null), t("admin.toastPurchaseVoided", { name: o.workspaceName }))}>
                        <X size={12} aria-hidden="true" /> {t("admin.voidPurchase")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls page={creditPurchasesPage.page} totalPages={creditPurchasesPage.totalPages} onChange={creditPurchasesPage.setPage} />
      </section>
      )}
    </Shell>
  );
}

/* ── Provision form ──────────────────────────────────────────────────────── */

function ProvisionForm({ onSubmit, onCancel, busy, applicant }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Prefilled when provisioning for a specific applicant, so their email is
  // never retyped — and never mistyped — at the point it matters most
  const [ownerEmail, setOwnerEmail] = useState(applicant?.email ?? "");
  const [slugTouched, setSlugTouched] = useState(false);

  // Suggest a slug from the name until the admin edits it themselves
  const effectiveSlug = slugTouched ? slug : slugify(name);

  return (
    <form
      className="pl-admin__form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), slug: effectiveSlug, ownerEmail: ownerEmail.trim() });
      }}
    >
      <div className="pl-admin__formrow">
        <label>
          <span>{t("admin.workspaceNameLabel")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
                 placeholder={t("admin.workspaceNamePlaceholder")} required autoFocus disabled={busy} />
        </label>
        <label>
          <span>{t("admin.slugLabel")}</span>
          <input value={effectiveSlug}
                 onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                 placeholder={t("admin.slugPlaceholder")} required disabled={busy} />
        </label>
        <label>
          <span>{t("admin.ownerEmailLabel")}</span>
          <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}
                 placeholder={t("admin.ownerEmailPlaceholder")} required disabled={busy} />
        </label>
      </div>
      <p className="pl-admin__formnote">
        {applicant ? `${t("admin.provisioningForApplicant", { name: applicant.fullName })} ` : ""}
        {t("admin.workspaceCreatedUnowned")}
      </p>
      <div className="pl-admin__formactions">
        <button type="button" className="pl-admin__ghost" onClick={onCancel} disabled={busy}>{t("admin.cancel")}</button>
        <button type="submit" className="pl-admin__btn" disabled={busy || !name.trim() || !ownerEmail.trim()}>
          {busy ? <><LoaderCircle size={15} className="pl-admin__spin" /> {t("admin.working")}</> : t("admin.createAndInvite")}
        </button>
      </div>
    </form>
  );
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/* ── The one moment the raw token is visible ─────────────────────────────── */

function IssuedLink({ issued, onDismiss }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const absolute = `${window.location.origin}${issued.invitationLink}`;

  return (
    <div className={`pl-admin__issued ${issued.delivered ? "" : "is-undelivered"}`}>
      <div>
        <strong>
          {issued.delivered
            ? t("admin.emailedTo", { email: issued.email })
            : t("admin.readyNotDelivered", { email: issued.email })}
        </strong>
        <p>
          {issued.delivered ? t("admin.linkBelowFallback") : t("admin.sendingFailedSelf")}
          {!issued.delivered && issued.deliveryDetail && (
            <><br /><span className="pl-admin__why">{t("admin.reason")} {issued.deliveryDetail}</span></>
          )}
        </p>
        <code>{absolute}</code>
      </div>
      <div className="pl-admin__issuedactions">
        <button
          className="pl-admin__btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(absolute);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setCopied(false);   // clipboard blocked; the link is on screen to copy by hand
            }
          }}
        >
          {copied ? <><Check size={14} /> {t("admin.copied")}</> : <><Copy size={14} /> {t("admin.copyLink")}</>}
        </button>
        <button className="pl-admin__ghost" onClick={onDismiss}>{t("admin.dismiss")}</button>
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="pl-admin">
      <style>{CSS}</style>
      <div className="pl-admin__langtoggle"><LanguageToggle /></div>
      <div className="pl-admin__inner">{children}</div>
    </div>
  );
}

const CSS = `
  .pl-admin {
    --ink: #E8EAED; --ink-soft: #949AA5; --line: #2A2F36;
    --surface: #1B1F24; --bg: #131619; --accent: #4C8DFF;
    --warn: #E0A83E; --ok: #4FBF8B; --danger: #E0615A;
    font-family: 'Karla', system-ui, sans-serif;
    background: var(--bg); color: var(--ink); min-height: 100vh; padding: 32px 26px 64px; position: relative;
  }
  .pl-admin *, .pl-admin *::before, .pl-admin *::after { box-sizing: border-box; }
  .pl-admin__inner { max-width: 1080px; margin: 0 auto; }
  .pl-admin__langtoggle { position: absolute; top: 20px; inset-inline-end: 26px; z-index: 3; }

  /* UIC-004: the page's own header (eyebrow + h1) is centered; its actions
     sit in their own row underneath rather than beside it. */
  .pl-admin__head { display: flex; flex-direction: column; align-items: center; gap: 14px; margin-bottom: 24px; }
  .pl-admin__headtitle { text-align: center; }
  .pl-admin__eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  .pl-admin h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.8rem; font-weight: 600; margin: 0; }
  .pl-admin__headactions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }

  .pl-admin__btn {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: inherit; font-size: 0.85rem; font-weight: 600;
    background: var(--accent); color: #0B1220; border: none; border-radius: 8px;
    padding: 8px 14px; cursor: pointer;
  }
  .pl-admin__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .pl-admin__ghost {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: inherit; font-size: 0.85rem;
    background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; cursor: pointer;
  }
  .pl-admin__ghost:hover { color: var(--ink); border-color: #3C434C; }


  .pl-admin__form { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  /* UIC-003: one property per row — label left, value right. */
  .pl-admin__formrow { display: grid; grid-template-columns: max-content 1fr; row-gap: 14px; column-gap: 16px; align-items: start; }
  .pl-admin__formrow > label { display: contents; }
  .pl-admin__form label > span:first-child { font-size: 0.8rem; font-weight: 600; padding-top: 9px; white-space: nowrap; }
  .pl-admin__form input {
    width: 100%; font-family: inherit; font-size: 0.9rem;
    background: #0F1215; color: var(--ink); border: 1px solid var(--line);
    border-radius: 8px; padding: 9px 11px;
  }
  .pl-admin__form input:focus-visible { outline: none; border-color: var(--accent); }
  .pl-admin__formnote { font-size: 0.8rem; color: var(--ink-soft); margin: 14px 0 0; line-height: 1.55; }
  .pl-admin__formactions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

  .pl-admin__issued {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap;
    background: rgba(76,141,255,0.1); border: 1px solid rgba(76,141,255,0.4);
    border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;
  }
  .pl-admin__issued p { font-size: 0.83rem; color: var(--ink-soft); margin: 6px 0 10px; max-width: 62ch; line-height: 1.55; }
  .pl-admin__issued code {
    display: block; font-family: 'IBM Plex Mono', monospace; font-size: 0.78rem;
    background: #0F1215; border: 1px solid var(--line); border-radius: 7px;
    padding: 9px 11px; word-break: break-all; color: var(--accent);
  }
  .pl-admin__issued.is-undelivered { background: rgba(224,168,62,0.1); border-color: rgba(224,168,62,0.45); }
  .pl-admin__issued.is-undelivered code { color: var(--warn); }
  .pl-admin__why { color: var(--warn); font-size: 0.8rem; }
  .pl-admin__issuedactions { display: flex; gap: 8px; flex-shrink: 0; }

  .pl-admin__apps { margin-bottom: 26px; }
  .pl-admin__h2 {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500;
    color: var(--ink-soft); margin: 0 0 10px;
  }
  .pl-admin__applist { display: flex; flex-direction: column; gap: 8px; }
  .pl-admin__app {
    display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 11px; padding: 14px 16px;
  }
  .pl-admin__app.is-attention { border-color: rgba(224,168,62,0.4); background: rgba(224,168,62,0.05); }
  .pl-admin__appwho { flex: 1; min-width: 200px; }
  .pl-admin__appwho strong { display: block; font-size: 0.93rem; }
  .pl-admin__appwho span { display: block; font-size: 0.79rem; color: var(--ink-soft); margin-top: 2px; }
  .pl-admin__appwho p { font-size: 0.83rem; color: var(--ink-soft); margin: 8px 0 0; max-width: 60ch; line-height: 1.55; }
  .pl-admin__appstate { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; flex-shrink: 0; }

  .pl-admin__tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
  .pl-admin__table { width: 100%; border-collapse: collapse; font-size: 0.87rem; min-width: 860px; }
  .pl-admin__table th {
    text-align: start; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-soft);
    font-weight: 500; padding: 11px 14px; background: var(--surface); border-bottom: 1px solid var(--line);
  }
  .pl-admin__table td { padding: 13px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  .pl-admin__table tr:last-child td { border-bottom: none; }
  .pl-admin__table tr.is-attention { background: rgba(224,168,62,0.06); }

  .pl-admin__wsname { display: block; font-weight: 600; }
  .pl-admin__slug { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); margin-top: 2px; }
  .pl-admin__pill {
    display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    background: #262B31; color: var(--ink-soft); border-radius: 20px; padding: 3px 9px;
  }
  .pl-admin__pill.is-warn { background: rgba(224,168,62,0.16); color: var(--warn); }
  .pl-admin__pill.is-ok { background: rgba(79,191,139,0.14); color: var(--ok); }
  .pl-admin__pill.is-danger { background: rgba(224,97,90,0.16); color: var(--danger); }
  .pl-admin__inv { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; font-size: 0.84rem; }
  .pl-admin__invmeta { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--ink-soft); margin-top: 2px; }
  .pl-admin__muted { color: var(--ink-soft); }

  .pl-admin__subs { margin-top: 30px; }
  .pl-admin__subshead { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .pl-admin__subshead .pl-admin__h2 { margin: 0; }
  .pl-admin__noteinput {
    font-family: inherit; font-size: 11.5px; width: 150px;
    background: #0F1215; color: var(--ink); border: 1px solid var(--line);
    border-radius: 6px; padding: 4px 8px;
  }
  .pl-admin__terminalnote { font-size: 10.5px; max-width: 22ch; line-height: 1.4; }
  .pl-admin__pendingchange { display: block; font-size: 10.5px; color: var(--accent-2); margin-top: 2px; }

  .pl-admin__actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .pl-admin__actions button {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: inherit; font-size: 11.5px;
    background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; cursor: pointer;
  }
  .pl-admin__actions button:hover:not(:disabled) { color: var(--ink); border-color: #3C434C; }
  .pl-admin__actions button:disabled { opacity: 0.45; cursor: not-allowed; }

  .pl-admin__loading, .pl-admin__empty {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    flex-direction: column; color: var(--ink-soft); font-size: 0.9rem;
    padding: 50px 20px; border: 1px dashed var(--line); border-radius: 12px;
  }
  .pl-admin__loading { flex-direction: row; }

  .pl-admin__denied {
    max-width: 460px; margin: 60px auto; text-align: center; color: var(--ink-soft);
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 40px 30px;
  }
  .pl-admin__denied h1 { font-size: 1.3rem; color: var(--ink); margin: 14px 0 10px; }
  .pl-admin__denied p { font-size: 0.9rem; line-height: 1.6; margin: 0 0 20px; }

  .pl-admin__spin { animation: plAdminSpin 0.9s linear infinite; }
  @keyframes plAdminSpin { to { transform: rotate(360deg); } }

  @media (max-width: 560px) {
    .pl-admin__formrow { grid-template-columns: 1fr; }
    .pl-admin__formrow > label { display: flex; flex-direction: column; gap: 5px; }
    .pl-admin__form label > span:first-child { padding-top: 0; white-space: normal; }
  }
  @media (prefers-reduced-motion: reduce) { .pl-admin__spin { animation: none; } }

  /* ── Tabs ─────────────────────────────────────────────────────────────── */
  .pl-admin__tabs { display: flex; justify-content: center; gap: 4px; margin-bottom: 22px; border-bottom: 1px solid var(--line); }
  .pl-admin__tabs button {
    font-family: inherit; font-size: 0.85rem; font-weight: 600; color: var(--ink-soft);
    background: transparent; border: 1px solid var(--line); border-radius: 6px; border-bottom: 2px solid transparent;
    padding: 9px 14px; cursor: pointer; margin-bottom: -1px;
  }
  .pl-admin__tabs button.is-active { color: var(--ink); border-bottom-color: var(--accent); }
  .pl-admin__tabs button:hover:not(.is-active) { color: var(--ink); background: var(--surface-2, rgba(255,255,255,0.06)); }
  .pl-admin__tabbadge {
    display: inline-flex; align-items: center; justify-content: center; min-width: 17px; height: 17px;
    margin-inline-start: 6px; padding: 0 5px; border-radius: 999px;
    background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; line-height: 1;
  }

  /* ── Catalog ──────────────────────────────────────────────────────────── */
  .pl-admin__cataloggrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .pl-admin__catalogcard {
    background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .pl-admin__catalogcard.is-retired { opacity: 0.55; }
  .pl-admin__catalogcardhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .pl-admin__catalogcardhead strong { font-size: 0.95rem; }

  .pl-admin__proplist {
    display: grid; grid-template-columns: max-content 1fr; row-gap: 6px; column-gap: 12px;
    font-size: 0.8rem; margin: 10px 0; color: var(--ink-soft);
  }
  .pl-admin__proplist span:nth-child(odd) { color: var(--ink-soft); }
  .pl-admin__proplist span:nth-child(even) { color: var(--ink); text-align: end; }

  .pl-admin__draftbanner {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: rgba(76,141,255,0.1); border: 1px solid rgba(76,141,255,0.35);
    border-radius: 8px; padding: 8px 10px; font-size: 0.78rem; color: var(--accent); margin-bottom: 8px;
  }
  .pl-admin__draftbanner button {
    display: inline-flex; align-items: center; gap: 4px; font-family: inherit; font-size: 11px;
    background: var(--accent); color: #0B1220; border: none; border-radius: 6px; padding: 4px 9px; cursor: pointer;
  }
  .pl-admin__draftbanner button:disabled { opacity: 0.5; cursor: not-allowed; }

  .pl-admin__overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 20px; z-index: 50; overflow-y: auto;
  }
  .pl-admin__panel {
    background: var(--surface); border: 1px solid var(--line); color: var(--ink); border-radius: 14px;
    max-width: 640px; width: 100%; padding: 28px 30px 30px; position: relative;
  }
  .pl-admin__panelclose { position: absolute; top: 16px; inset-inline-end: 16px; background: transparent; border: none; cursor: pointer; color: var(--ink-soft); }
  .pl-admin__panelclose:hover { color: var(--ink); }
  .pl-admin__panelh2 { margin: 2px 0 18px; text-align: center; font-family: 'Fraunces', Georgia, serif; }
  .pl-admin__panel .pl-admin__formrow { row-gap: 12px; }
  .pl-admin__panel select {
    width: 100%; font-family: inherit; font-size: 0.9rem;
    background: #0F1215; color: var(--ink); border: 1px solid var(--line);
    border-radius: 8px; padding: 9px 11px;
  }

  ${LANGUAGE_TOGGLE_CSS}
  ${PAGINATION_CONTROLS_CSS}
`;
