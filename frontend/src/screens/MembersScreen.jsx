import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  LoaderCircle, Crown, UploadCloud, Download, Search,
  PauseCircle, PlayCircle, UserX, UserCheck, Plus, X, RefreshCw,
  ChevronLeft, ChevronRight, Mail, Inbox, GraduationCap, Users,
} from "lucide-react";
import QRCode from "qrcode";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import { useTheme } from "../theme/useTheme";
import Message from "../components/Message";
import Notice from "../components/Notice";

/* =========================================================================
   MEMBERS SCREEN — the tutor's own member management.

   Replaces the prototype's simulated version with the real Membership
   lifecycle. Everything here is Workspace-scoped: the roles shown, the roles
   assignable, and the caller's own right to change any of it, all resolved
   server-side from the caller's Membership on every request.

   The owner's row is deliberately different. INV-006 protects the Membership
   currently designated Workspace Owner from suspension, archival and removal
   until ownership has been transferred, so those actions are absent rather
   than present-and-failing.
   ========================================================================= */

// Temporarily restricted for invitations only — Administrator, AssistantTeacher,
// Parent and FinanceManager are grantable via RoleAdder but not invitable yet.
const INVITE_GRANTABLE = ["Teacher", "Learner"];

/** Roles a workspace manager may grant. Owner is absent on purpose — ownership
    transfers, it is not assigned (BA-006). */
const GRANTABLE = ["Administrator", "Teacher", "AssistantTeacher", "Learner", "Parent", "FinanceManager"];

/** How many cards a page of the members/invitations grid shows before paging. */
const MEMBERS_PAGE_SIZE = 8;
const INVITES_PAGE_SIZE = 8;

export default function MembersScreen({ initialTab }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const { mode } = useTheme();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [courseRequests, setCourseRequests] = useState([]);
  const [setup, setSetup] = useState(null);
  const [products, setProducts] = useState([]);
  // Only ever set by the initial load — a page that never had anything to
  // show still needs a blocking message. Once `data` exists, run()/load()
  // failures go to a toast instead (see run() below): stale-but-valid
  // content stays on screen rather than being replaced by an error.
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // The last bulk-invite submission's per-recipient breakdown, shown above
  // the form until dismissed or the next submission replaces it.
  const [bulkResult, setBulkResult] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSort, setMemberSort] = useState("date");
  const [memberPage, setMemberPage] = useState(0);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteSort, setInviteSort] = useState("issued");
  const [invitePage, setInvitePage] = useState(0);
  const [tab, setTab] = useState(initialTab || "current");
  // Bumped after a successful send to remount BulkInviteForm with fresh
  // state — the simplest way to make the tab look "just entered" again.
  const [createFormKey, setCreateFormKey] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  // Which member row (if any) has its inline "enrol in a course" picker open.
  const [enrollingId, setEnrollingId] = useState(null);
  const [enrollProductId, setEnrollProductId] = useState("");

  const load = useCallback(
    () => Promise.all([
      api.getMembers(session.token, slug),
      // A member who cannot review simply has no queue — not an error
      api.getJoinRequests(session.token, slug).catch(() => []),
      api.getCourseJoinRequests(session.token, slug).catch(() => []),
      api.getSetup(session.token, slug).catch(() => null),
      api.getProducts(session.token, slug).catch(() => null),
    ]).then(([members, joins, courseJoins, setupResp, productsResp]) => {
      setData(members); setRequests(joins); setCourseRequests(courseJoins); setSetup(setupResp);
      setProducts(productsResp?.products ?? []);
    }).catch((e) => toast.error(e.message)),
    [session.token, slug]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getMembers(session.token, slug),
      api.getJoinRequests(session.token, slug).catch(() => []),
      api.getCourseJoinRequests(session.token, slug).catch(() => []),
      api.getSetup(session.token, slug).catch(() => null),
      api.getProducts(session.token, slug).catch(() => null),
    ]).then(([members, joins, courseJoins, setupResp, productsResp]) => {
      if (cancelled) return;
      setData(members); setRequests(joins); setCourseRequests(courseJoins); setSetup(setupResp);
      setProducts(productsResp?.products ?? []);
      setError(null);
    }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  // The QR just re-encodes the same /join/{slug} link the card already
  // shows — only worth generating while that link is actually reachable.
  useEffect(() => {
    if (!setup?.acceptsJoinRequests || !setup?.slug) return;
    let cancelled = false;
    const joinUrl = `${window.location.origin}/join/${setup.slug}`;
    QRCode.toDataURL(joinUrl, { width: 176, margin: 1 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; setQrDataUrl(null); };
  }, [setup?.acceptsJoinRequests, setup?.slug]);

  /** `successMessage` may be a plain string, or a function of the resolved result
      for callers whose toast text depends on what the call returned (e.g. counts). */
  async function run(fn, successMessage) {
    setBusy(true);
    try {
      const result = await fn();
      const message = typeof successMessage === "function" ? successMessage(result) : successMessage;
      if (message) toast.success(message);
      await load();
      return result;
    } catch (e) {
      toast.error(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="lw-page">
        <Message type="error">{error}</Message>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="lw-page">
        <div className="lw-members__loading"><LoaderCircle size={18} className="lw-members__spin" /> {t("members.loading")}</div>
      </div>
    );
  }

  // Sent or Expired only — an Accepted invitation is a Membership now (§10.1)
  // and a Cancelled one is finished; neither belongs in this queue (§9).
  const pendingInvites = data.invitations.filter((i) => i.status === "Sent" || i.status === "Expired");
  const pendingRequests = requests.filter((r) => r.status === "Submitted");
  const pendingCourseRequests = courseRequests.filter((r) => r.status === "Submitted");
  // Only a Published product is enrollable (§12.3) — same rule the enroll-time
  // check enforces server-side. Open ones are excluded too: anyone can already
  // get in there themselves the moment they open it (Enrollment auto-creates
  // on first visit), so a manual Enroll action has nothing to do for those —
  // only Invite-only and Approval-required courses need a tutor's hand. Kept
  // together here since a tutor enrolling an existing member is a direct
  // override either way (same underlying action as approving a course join
  // request, just skipping the request).
  const publishedProducts = products.filter((p) => p.status === "Published" && p.enrollmentMode !== "Open");
  // Per-member: only courses this member still needs enrolling into — the
  // picker has nothing to offer for one they're already enrolled in.
  const enrollableProducts = (m) =>
    publishedProducts.filter((p) => !m.enrolledCourses.some((c) => c.learningProductId === p.id));
  // "Invite for a course" only pre-tags an intended course on the Invitation
  // (ProvisioningService §12.3 — accepting never auto-enrolls, a tutor still
  // enrols manually afterward). Approval-required is excluded here on purpose:
  // a brand-new invitee isn't a Member yet and can't submit a course join
  // request themselves, so pre-tagging one at invite time would let a tutor
  // route around the "ask first" flow entirely — they can still enrol the
  // member into it manually once they've joined, same as any other member.
  const inviteCourseOptions = publishedProducts.filter((p) => p.enrollmentMode === "InvitationOnly");

  const memberQuery = memberSearch.trim().toLowerCase();
  const filteredMembers = data.members.filter((m) =>
    !memberQuery || m.fullName.toLowerCase().includes(memberQuery) || m.email.toLowerCase().includes(memberQuery));
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    // The owner's row stays pinned first regardless of sort — it's the one
    // row whose available actions differ, so it should never be hunted for.
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    if (memberSort === "email") return a.email.localeCompare(b.email);
    if (memberSort === "name") return a.fullName.localeCompare(b.fullName);
    // "date" — the most recently created/updated member first
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const memberTotalPages = Math.max(1, Math.ceil(sortedMembers.length / MEMBERS_PAGE_SIZE));
  const currentMemberPage = Math.min(memberPage, memberTotalPages - 1);
  const pagedMembers = sortedMembers.slice(
    currentMemberPage * MEMBERS_PAGE_SIZE, (currentMemberPage + 1) * MEMBERS_PAGE_SIZE);

  const inviteQuery = inviteSearch.trim().toLowerCase();
  const filteredInvites = pendingInvites.filter((i) => !inviteQuery || i.email.toLowerCase().includes(inviteQuery));
  const sortedInvites = [...filteredInvites].sort((a, b) => {
    if (inviteSort === "email") return a.email.localeCompare(b.email);
    if (inviteSort === "expiration") return new Date(a.expiresAt) - new Date(b.expiresAt);
    // "issued" — the most recently sent/resent invitation first
    return new Date(b.issuedAt) - new Date(a.issuedAt);
  });
  const inviteTotalPages = Math.max(1, Math.ceil(sortedInvites.length / INVITES_PAGE_SIZE));
  // Clamped rather than stored: if a reload/search/sort shrinks the list, the
  // page the user was on could otherwise point past the end.
  const currentInvitePage = Math.min(invitePage, inviteTotalPages - 1);
  const pagedInvites = sortedInvites.slice(
    currentInvitePage * INVITES_PAGE_SIZE, (currentInvitePage + 1) * INVITES_PAGE_SIZE);

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      {/* Sonner portals to document.body, outside .lw-root where this
          workspace's theme tokens live as inline custom properties, so it
          can't pick up var(--accent) etc. via CSS inheritance the way
          Message.jsx does — richColors gives it its own built-in palette
          instead. `theme` is Sonner's own light/dark switch, wired to this
          app's ThemeContext (2026-08-21 fix) so that palette still follows
          the owner's actual mode instead of defaulting to light always. */}
      <Toaster position="top-right" richColors closeButton theme={mode} />

      <div className="lw-eyebrow">{t("members.eyebrow")}</div>
      <h1>{t("members.title")}</h1>
      <p className="lw-sub">{t("members.lead", { workspace: data.workspaceName })}</p>

      <div className="lw-members__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "current"}
                className={tab === "current" ? "is-active" : ""} onClick={() => setTab("current")}>
          {t("members.tabCurrent")}
        </button>
        <button type="button" role="tab" aria-selected={tab === "pending"}
                className={tab === "pending" ? "is-active" : ""} onClick={() => setTab("pending")}>
          {t("members.tabPending")}
        </button>
        {data.canManage && (
          <button type="button" role="tab" aria-selected={tab === "create"}
                  className={tab === "create" ? "is-active" : ""} onClick={() => setTab("create")}>
            {t("members.tabCreate")}
          </button>
        )}
        <button type="button" role="tab" aria-selected={tab === "join"}
                className={tab === "join" ? "is-active" : ""} onClick={() => setTab("join")}>
          {t("members.tabJoinLink")}
        </button>
        <button type="button" className="lw-members__tabsrefresh" onClick={load} disabled={busy} aria-label={t("members.refresh")}>
          <RefreshCw size={13} />
        </button>
      </div>

      {tab === "current" && (
        <>
          <GridToolbar
            search={memberSearch}
            onSearchChange={(v) => { setMemberSearch(v); setMemberPage(0); }}
            searchPlaceholder={t("members.searchMembers")}
            sortValue={memberSort}
            onSortChange={(v) => { setMemberSort(v); setMemberPage(0); }}
            sortOptions={[
              { value: "date", label: t("members.sortByDate") },
              { value: "name", label: t("members.sortByName") },
              { value: "email", label: t("members.sortByEmail") },
            ]}
          />

          {sortedMembers.length === 0 && (
            <Notice tone="readonly">{t("members.noMembersFound")}</Notice>
          )}

          <div className="lw-members__grid lw-members__grid--members">
            {pagedMembers.map((m) => (
              <div className="lw-members__row" key={m.membershipId}>
                <div className="lw-members__avatar">{m.fullName.trim()[0]}</div>

                <div className="lw-members__who">
                  <div className="lw-members__name">
                    {m.fullName}
                    {m.isOwner && <span className="lw-members__owner"><Crown size={11} /> {t("members.owner")}</span>}
                  </div>
                  <div className="lw-members__email">{m.email}</div>
                  <div className="lw-members__roles">
                    {m.roles.map((r) => (
                      <span className="lw-members__role" key={r}>
                        {humanise(t, r)}
                        {data.canManage && r !== "Owner" && (
                          <button
                            aria-label={t("members.removeRole", { role: humanise(t, r) })}
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(t("members.confirmRemoveRole", { role: humanise(t, r), name: m.fullName }))) return;
                              run(() => api.removeMemberRole(session.token, slug, m.membershipId, r), t("members.toastRoleRemoved", { role: humanise(t, r) }));
                            }}
                          ><X size={10} /></button>
                        )}
                      </span>
                    ))}
                    {data.canManage && (
                      <RoleAdder
                        busy={busy}
                        existing={m.roles}
                        onAdd={(role) => run(() => api.assignMemberRole(session.token, slug, m.membershipId, role), t("members.toastRoleAdded", { role: humanise(t, role) }))}
                      />
                    )}
                  </div>

                  {(m.enrolledCourses.length > 0 || (m.roles.includes("Learner") && m.pendingInvitedProductTitle)) && (
                    <div className="lw-members__courses">
                      {m.enrolledCourses.map((c) => (
                        <span className="lw-members__course lw-members__course--enrolled" key={c.learningProductId}>
                          {c.title}
                        </span>
                      ))}
                      {/* Only a Learner can be enrolled, so this is only ever
                          actionable (via the Enroll button below) for one —
                          a non-Learner with a stray intended course from
                          before a role change has nothing to act on. */}
                      {m.roles.includes("Learner") && m.pendingInvitedProductTitle && (
                        <span className="lw-members__course lw-members__course--pending">
                          {t("members.awaitingEnrollment", { course: m.pendingInvitedProductTitle })}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <span className={`lw-members__status is-${m.status.toLowerCase()}`}>{statusLabel(t, m.status)}</span>

                {data.canManage && (
                  <div className="lw-members__actions">
                    {m.status === "Pending" && (
                      <button disabled={busy} onClick={() => run(() => api.memberAction(session.token, slug, m.membershipId, "activate"), t("members.toastActivated", { name: m.fullName }))}>
                        <PlayCircle size={12} /> {t("members.activate")}
                      </button>
                    )}
                    {/* INV-006: the owner's row offers none of these until ownership moves */}
                    {!m.isOwner && m.status === "Active" && (
                      <button disabled={busy} onClick={() => run(() => api.memberAction(session.token, slug, m.membershipId, "suspend"), t("members.toastSuspended", { name: m.fullName }))}>
                        <PauseCircle size={12} /> {t("members.suspend")}
                      </button>
                    )}
                    {!m.isOwner && m.status === "Suspended" && (
                      <button disabled={busy} onClick={() => run(() => api.memberAction(session.token, slug, m.membershipId, "reinstate"), t("members.toastReinstated", { name: m.fullName }))}>
                        <PlayCircle size={12} /> {t("members.reinstate")}
                      </button>
                    )}
                    {m.status === "Active" && m.roles.includes("Learner") && enrollableProducts(m).length > 0 && (
                      enrollingId === m.membershipId ? (
                        <span className="lw-members__enrollinline">
                          <select value={enrollProductId} disabled={busy} autoFocus
                                  onChange={(e) => setEnrollProductId(e.target.value)}>
                            <option value="" disabled>{t("members.bulkCoursePlaceholder")}</option>
                            {enrollableProducts(m).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                          </select>
                          <button disabled={busy || !enrollProductId}
                                  onClick={() => run(
                                    () => api.enrollMember(session.token, slug, m.membershipId, enrollProductId),
                                    t("members.toastEnrolled", { name: m.fullName }))
                                    .then(() => { setEnrollingId(null); setEnrollProductId(""); })}>
                            <UserCheck size={12} /> {t("members.confirm")}
                          </button>
                          <button disabled={busy} onClick={() => { setEnrollingId(null); setEnrollProductId(""); }}>
                            <X size={12} />
                          </button>
                        </span>
                      ) : (
                        <button disabled={busy}
                                onClick={() => { setEnrollingId(m.membershipId); setEnrollProductId(m.pendingInvitedProductId ?? ""); }}>
                          <UserCheck size={12} /> {t("members.enroll")}
                        </button>
                      )
                    )}
                    {!m.isOwner && m.status === "Active" && (
                      <button disabled={busy} onClick={() => {
                        if (!window.confirm(t("members.confirmRemove", { name: m.fullName }))) return;
                        run(() => api.memberAction(session.token, slug, m.membershipId, "remove"), t("members.toastRemoved", { name: m.fullName }));
                      }}>
                        <UserX size={12} /> {t("members.remove")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pager page={currentMemberPage} totalPages={memberTotalPages} onChange={setMemberPage} />

          {!data.canManage && <Notice tone="readonly">{t("members.readonlyNote")}</Notice>}
        </>
      )}

      {tab === "pending" && (
        <>
          {pendingRequests.length === 0 && pendingCourseRequests.length === 0 && pendingInvites.length === 0 && (
            <Notice tone="empty" icon={Inbox} title={t("members.pendingEmpty")}>
              <p>{t("members.pendingEmptyBody")}</p>
            </Notice>
          )}

          {/* People who asked to get in, rather than being asked. Placed above
              invitations because these are the ones waiting on a decision. */}
          {pendingRequests.length > 0 && (
            <>
              <h2 className="lw-sectiontitle">{t("members.requestsToJoin")}</h2>
              <div className="lw-members__list">
                {pendingRequests.map((r) => (
                  <div className="lw-members__row" key={r.id}>
                    <div className="lw-members__avatar is-request">{r.fullName.trim()[0]}</div>
                    <div className="lw-members__who">
                      <div className="lw-members__name">{r.fullName}</div>
                      <div className="lw-members__email">
                        {t("members.askedToJoinAs", { email: r.email, role: humanise(t, r.requestedRole) })}
                      </div>
                      {r.message && <div className="lw-members__msg">“{r.message}”</div>}
                    </div>
                    <span className="lw-members__status is-pending">{statusLabel(t, r.status)}</span>
                    {data.canManage && (
                      <div className="lw-members__actions">
                        <button disabled={busy}
                                onClick={() => run(() => api.decideJoinRequest(session.token, slug, r.id, "approve"), t("members.toastRequestApproved", { name: r.fullName }))}>
                          <UserCheck size={12} /> {t("members.approve")}
                        </button>
                        <button disabled={busy}
                                onClick={() => run(() => api.decideJoinRequest(session.token, slug, r.id, "decline"), t("members.toastRequestDeclined", { name: r.fullName }))}>
                          <X size={12} /> {t("members.decline")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Existing Members asking for one specific course, not the Workspace itself. */}
          {pendingCourseRequests.length > 0 && (
            <>
              <h2 className="lw-sectiontitle">{t("members.courseRequestsToJoin")}</h2>
              <div className="lw-members__list">
                {pendingCourseRequests.map((r) => (
                  <div className="lw-members__row" key={r.id}>
                    <div className="lw-members__avatar is-request">{r.memberFullName.trim()[0]}</div>
                    <div className="lw-members__who">
                      <div className="lw-members__name">{r.memberFullName}</div>
                      <div className="lw-members__email">
                        {t("members.requestedAccessTo", { email: r.memberEmail, course: r.productTitle })}
                      </div>
                      {r.message && <div className="lw-members__msg">“{r.message}”</div>}
                    </div>
                    <span className="lw-members__status is-pending">{statusLabel(t, r.status)}</span>
                    {data.canManage && (
                      <div className="lw-members__actions">
                        <button disabled={busy}
                                onClick={() => run(() => api.decideCourseJoinRequest(session.token, slug, r.id, "approve"), t("members.toastCourseRequestApproved", { name: r.memberFullName }))}>
                          <UserCheck size={12} /> {t("members.approve")}
                        </button>
                        <button disabled={busy}
                                onClick={() => run(() => api.decideCourseJoinRequest(session.token, slug, r.id, "decline"), t("members.toastCourseRequestDeclined", { name: r.memberFullName }))}>
                          <X size={12} /> {t("members.decline")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {pendingInvites.length > 0 && (
            <>
              <h2 className="lw-sectiontitle">{t("members.pendingInvitations")}</h2>
              <GridToolbar
                search={inviteSearch}
                onSearchChange={(v) => { setInviteSearch(v); setInvitePage(0); }}
                searchPlaceholder={t("members.searchInvitations")}
                sortValue={inviteSort}
                onSortChange={(v) => { setInviteSort(v); setInvitePage(0); }}
                sortOptions={[
                  { value: "issued", label: t("members.sortByDate") },
                  { value: "expiration", label: t("members.sortByExpiration") },
                  { value: "email", label: t("members.sortByEmail") },
                ]}
              />

              {sortedInvites.length === 0 && (
                <Notice tone="readonly">{t("members.noInvitationsFound")}</Notice>
              )}

              <div className="lw-members__grid">
                {pagedInvites.map((i) => (
                  <div className="lw-members__row" key={i.id}>
                    <div className="lw-members__avatar is-pending"><Mail size={16} /></div>
                    <div className="lw-members__who">
                      <div className="lw-members__name">{i.email}</div>
                      <div className="lw-members__email">
                        {t("members.invitedAs", { role: humanise(t, i.intendedRole), date: new Date(i.expiresAt).toLocaleDateString() })}
                      </div>
                      {i.intendedLearningProductTitle && (
                        <div className="lw-members__course">{t("members.invitedCourse", { course: i.intendedLearningProductTitle })}</div>
                      )}
                    </div>
                    <span className={`lw-members__status is-${i.status.toLowerCase()}`}>{statusLabel(t, i.status)}</span>

                    {data.canManage && (
                      <div className="lw-members__actions">
                        {/* Resend is legal from Sent or Expired (§9) — both are exactly what's in this queue */}
                        <button disabled={busy}
                                onClick={() => run(() => api.resendMemberInvitation(session.token, slug, i.id), t("members.toastInvitationResent", { email: i.email }))}>
                          <RefreshCw size={12} /> {t("members.resend")}
                        </button>
                        {/* Cancel is only legal before the invitation has ever lapsed (§9) */}
                        {i.status === "Sent" && (
                          <button disabled={busy}
                                  onClick={() => run(() => api.cancelMemberInvitation(session.token, slug, i.id), t("members.toastInvitationCancelled", { email: i.email }))}>
                            <X size={12} /> {t("members.cancel")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Pager page={currentInvitePage} totalPages={inviteTotalPages} onChange={setInvitePage} />
            </>
          )}
        </>
      )}

      {tab === "create" && data.canManage && (
        <>
          <BulkInviteResult result={bulkResult} onDismiss={() => setBulkResult(null)} />
          <BulkInviteForm
            key={createFormKey}
            busy={busy}
            publishedProducts={inviteCourseOptions}
            onSubmit={async (body) => {
              const res = await run(
                () => api.inviteMembersBulk(session.token, slug, body),
                (result) => t("members.bulkResultSummary", { issued: result.issuedCount, skipped: result.skippedCount }));
              // Toast covers the summary; the per-recipient breakdown (who was
              // actually issued vs skipped, and why) is the thing a toast is
              // too small to show, so it goes into its own panel instead.
              if (res) { setCreateFormKey((k) => k + 1); setBulkResult(res); }
            }}
          />
        </>
      )}

      {tab === "join" && setup && (
        <div className={`lw-members__joinreq ${setup.acceptsJoinRequests ? "is-on" : ""}`}>
          <div>
            <div className="lw-members__joinreqtitle">
              {setup.acceptsJoinRequests ? t("members.joinOpenTitle") : t("members.joinClosedTitle")}
            </div>
            <p>{setup.acceptsJoinRequests ? t("members.joinOpenBody") : t("members.joinClosedBody")}</p>
          </div>
          {setup.canManage && (
            <button
              className={`lw-btn ${setup.acceptsJoinRequests ? "lw-btn--ghost" : "lw-btn--accent"} lw-btn--sm`}
              disabled={busy}
              onClick={() => run(
                () => api.setAcceptsJoinRequests(session.token, slug, !setup.acceptsJoinRequests),
                setup.acceptsJoinRequests ? t("members.toastJoinRequestsOff") : t("members.toastJoinRequestsOn"),
              )}
            >
              {busy
                ? <LoaderCircle size={14} className="lw-members__spin" />
                : setup.acceptsJoinRequests ? t("members.turnOff") : t("members.turnOn")}
            </button>
          )}

          {qrDataUrl && (
            <div className="lw-members__joinqr">
              <img src={qrDataUrl} width={88} height={88} alt={`QR code linking to /join/${setup.slug}`} />
              <div>
                <div className="lw-members__joinqrlabel">{t("members.scanToJoin")}</div>
                <code>{`${window.location.origin}/join/${setup.slug}`}</code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Bits ─────────────────────────────────────────────────────────────────── */

function RoleAdder({ existing, onAdd, busy }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const available = GRANTABLE.filter((r) => !existing.includes(r));
  if (available.length === 0) return null;

  return open ? (
    <select
      className="lw-members__rolepick"
      autoFocus
      disabled={busy}
      defaultValue=""
      onChange={(e) => { if (e.target.value) { onAdd(e.target.value); setOpen(false); } }}
      onBlur={() => setOpen(false)}
    >
      <option value="" disabled>{t("members.addRole")}</option>
      {available.map((r) => <option key={r} value={r}>{humanise(t, r)}</option>)}
    </select>
  ) : (
    <button className="lw-members__roleadd" onClick={() => setOpen(true)} disabled={busy}>
      <Plus size={10} /> {t("members.role")}
    </button>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits pasted text into candidate email entries — one per line, or comma-separated. */
function splitEmailList(text) {
  return text.split(/[\n,]+/).map((email) => ({ email }));
}

/** Header + one example row, in the exact "Name,Email" shape parseCsvRecipients expects. */
const CSV_TEMPLATE = "Name,Email\nJane Doe,jane.doe@example.com\n";

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "invitation-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Parses a simple CSV student list (§4.2). If a header row names an "email"
 * column, that column is used (and "name", if present, is kept for preview
 * only — it is never sent to the backend, which has no name field on
 * Invitation). Without a recognisable header, a two-column file is assumed
 * to be "Name,Email" per the doc's own example; a single column is treated
 * as email-only.
 */
function parseCsvRecipients(text) {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(","));
  if (rows.length === 0) return [];

  const header = rows[0].map((c) => c.trim().toLowerCase());
  let emailIdx = header.indexOf("email");
  let nameIdx = header.indexOf("name");
  let dataRows = rows;

  if (emailIdx !== -1) {
    dataRows = rows.slice(1);
  } else {
    emailIdx = rows[0].length > 1 ? 1 : 0;
    nameIdx = rows[0].length > 1 ? 0 : -1;
  }

  return dataRows.map((r) => ({
    email: (r[emailIdx] ?? "").trim(),
    name: nameIdx >= 0 ? (r[nameIdx] ?? "").trim() : "",
  }));
}

/**
 * Cheap heuristic for "this isn't actually text" — catches the common
 * mistake of picking a spreadsheet (.xlsx/.xls/.ods) instead of a real CSV.
 * Office Open XML / ODF files are ZIP archives, always starting with the
 * "PK" local-file-header signature; genuine CSV/text never does, and never
 * contains a NUL byte or a dense run of other control characters.
 */
function looksLikeBinary(text) {
  if (text.startsWith("PK")) return true;

  const sample = text.slice(0, 2000);
  if (sample.length === 0) return false;

  let controlCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0) return true;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) controlCount++;
  }
  return controlCount / sample.length > 0.05;
}

/** Trims, lower-cases, drops blanks/malformed addresses, and dedupes case-insensitively. */
function normaliseRecipients(entries) {
  const seen = new Set();
  const valid = [];
  let invalidCount = 0;

  for (const entry of entries) {
    const email = (entry.email || "").trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email) || seen.has(email)) { invalidCount++; continue; }
    seen.add(email);
    valid.push({ email, name: entry.name || "" });
  }

  return { valid, invalidCount };
}

function BulkInviteForm({ onSubmit, busy, publishedProducts }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("emails");
  const [role, setRole] = useState("Learner");
  const [text, setText] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [csvEntries, setCsvEntries] = useState([]);
  const [csvError, setCsvError] = useState(null);
  const fileInputRef = useRef(null);
  // §12.3 "Invite + Enroll": one course applies to the whole batch, not per
  // recipient. Nothing to offer if the workspace has no Published product yet.
  const [enrollMode, setEnrollMode] = useState("workspace");
  const [courseId, setCourseId] = useState("");

  const rawEntries = mode === "emails" ? splitEmailList(text) : csvEntries;
  const { valid, invalidCount } = normaliseRecipients(rawEntries);

  async function handleFile(file) {
    if (!file) return;
    setCsvFile(file);

    const content = await file.text();
    if (looksLikeBinary(content)) {
      setCsvEntries([]);
      setCsvError(t("members.bulkCsvBinaryError"));
      return;
    }

    setCsvError(null);
    setCsvEntries(parseCsvRecipients(content));
  }

  return (
    <form
      className="lw-members__form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          role,
          source: mode === "emails" ? "EmailList" : "CsvImport",
          recipients: valid.map((v) => ({ email: v.email })),
          intendedLearningProductId: enrollMode === "course" && courseId ? courseId : null,
        });
      }}
    >
      <div className="lw-members__formsection"><UserCheck size={13} /> {t("members.bulkSectionWho")}</div>
      <label>
        <span>{t("members.role")}</span>
        <select value={role} onChange={(e) => {
          const next = e.target.value;
          setRole(next);
          // Course intent only makes sense for a Learner — switching away
          // clears it rather than silently carrying a course nobody will act on.
          if (next !== "Learner") { setEnrollMode("workspace"); setCourseId(""); }
        }} disabled={busy}>
          {INVITE_GRANTABLE.map((r) => <option key={r} value={r}>{humanise(t, r)}</option>)}
        </select>
      </label>

      <div className="lw-members__formsection"><Mail size={13} /> {t("members.bulkSectionHow")}</div>
      <label>
        <span />
        <div className="lw-members__modetoggle">
          <button type="button" className={mode === "emails" ? "is-active" : ""} disabled={busy}
                  onClick={() => setMode("emails")}>
            {t("members.bulkModeEmails")}
          </button>
          <button type="button" className={mode === "csv" ? "is-active" : ""} disabled={busy}
                  onClick={() => setMode("csv")}>
            {t("members.bulkModeCsv")}
          </button>
        </div>
      </label>

      {role === "Learner" && publishedProducts.length > 0 && (
        <>
          <div className="lw-members__formsection"><GraduationCap size={13} /> {t("members.bulkSectionEnrollment")}</div>
          <div className="lw-members__formrow">
            <span>{t("members.bulkEnrollLabel")}</span>
            <div className="lw-members__enroll">
              <label className="lw-members__radio">
                <input type="radio" name="enrollMode" checked={enrollMode === "workspace"} disabled={busy}
                       onChange={() => setEnrollMode("workspace")} />
                {t("members.bulkEnrollWorkspaceOnly")}
              </label>
              <label className="lw-members__radio">
                <input type="radio" name="enrollMode" checked={enrollMode === "course"} disabled={busy}
                       onChange={() => setEnrollMode("course")} />
                {t("members.bulkEnrollInCourse")}
              </label>
              {enrollMode === "course" && (
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={busy} autoFocus>
                  <option value="" disabled>{t("members.bulkCoursePlaceholder")}</option>
                  {publishedProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              )}
            </div>
          </div>
        </>
      )}

      <div className="lw-members__formsection"><Users size={13} /> {t("members.bulkSectionRecipients")}</div>
      {mode === "emails" ? (
        <label>
          <span>{t("members.bulkEmailsLabel")}</span>
          <textarea
            rows={5} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={t("members.bulkEmailsPlaceholder")} disabled={busy} autoFocus
          />
        </label>
      ) : (
        // Deliberately NOT a <label> wrapping the file input: a label
        // natively forwards its own click to a nested form control, which
        // would fire a *second* click on the input alongside the explicit
        // fileInputRef.click() below. Chromium silently drops the redundant
        // one, but WebKit/Firefox are known to actually open (or reset) a
        // second file dialog for this exact pattern, breaking selection —
        // this is what made CSV import unreliable. ContentStudioScreen's
        // working dropzone avoids a <label> wrapper for the same reason.
        <div className="lw-members__formrow">
          <span>{t("members.bulkCsvLabel")}</span>
          <div>
            <div className="lw-dropzone lw-dropzone--compact" role="button" tabIndex={0}
                 onClick={() => fileInputRef.current?.click()}>
              <UploadCloud size={22} />
              <span className="lw-dropzone__title">
                {csvFile
                  ? (csvError ? csvFile.name : t("members.bulkCsvChosen", { name: csvFile.name, count: valid.length }))
                  : t("members.bulkCsvChoose")}
              </span>
              <span className="lw-dropzone__meta">{t("members.bulkCsvHint")}</span>
              <input
                ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
              />
            </div>
            <button type="button" className="lw-members__templatelink" onClick={downloadCsvTemplate}>
              <Download size={12} /> {t("members.bulkCsvTemplateLink")}
            </button>
          </div>
        </div>
      )}

      <div className="lw-members__formrow">
        <span />
        <div className="lw-members__bulkpreview">
          {mode === "csv" && csvError ? (
            <span className="is-warn">{csvError}</span>
          ) : valid.length > 0 ? (
            <>
              <span>{t("members.bulkReadyCount", { count: valid.length })}</span>
              {invalidCount > 0 && <span className="is-warn">{t("members.bulkInvalidSkipped", { count: invalidCount })}</span>}
            </>
          ) : invalidCount > 0 ? (
            <span className="is-warn">{t("members.bulkNoValidFound")}</span>
          ) : (
            <span className="is-muted">{t("members.bulkNoRecipients")}</span>
          )}
        </div>
      </div>

      <div className="lw-members__formactions">
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm"
                disabled={busy || valid.length === 0 || (enrollMode === "course" && !courseId)}>
          {busy ? <LoaderCircle size={14} className="lw-members__spin" /> : t("members.bulkSend")}
        </button>
      </div>
    </form>
  );
}

/**
 * Per-recipient breakdown of the last bulk-invite submission — who was
 * actually issued an invitation vs skipped, and why. The success toast
 * covers "18 issued · 2 skipped"; this is the answer to the follow-up
 * question a tutor would then have, "okay, but which two?"
 */
function BulkInviteResult({ result, onDismiss }) {
  const { t } = useLanguage();
  if (!result) return null;

  return (
    <div className="lw-members__bulkresult">
      <div className="lw-members__bulkresulthead">
        <span>{t("members.bulkResultSummary", { issued: result.issuedCount, skipped: result.skippedCount })}</span>
        <button type="button" onClick={onDismiss} aria-label={t("members.bulkResultDismiss")}><X size={13} /></button>
      </div>
      <div className="lw-members__list">
        {result.results.map((r) => (
          <div className="lw-members__row lw-members__row--compact" key={r.email}>
            <div className={`lw-members__avatar ${r.outcome === "issued" ? "" : "is-pending"}`}>
              {r.outcome === "issued" ? <Mail size={14} /> : <X size={14} />}
            </div>
            <div className="lw-members__who">
              <div className="lw-members__name">{r.email}</div>
              {r.reason && <div className="lw-members__email">{r.reason}</div>}
            </div>
            <span className={`lw-members__status ${r.outcome === "issued" ? "is-active" : "is-suspended"}`}>
              {r.outcome === "issued" ? t("members.bulkOutcomeIssued") : t("members.bulkOutcomeSkipped")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridToolbar({ search, onSearchChange, searchPlaceholder, sortValue, onSortChange, sortOptions }) {
  const { t } = useLanguage();
  return (
    <div className="lw-members__toolbar">
      <label className="lw-members__searchbox">
        <Search size={14} />
        <input
          type="search" value={search} onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>
      <label className="lw-members__sortbox">
        <span>{t("members.sortBy")}</span>
        <select value={sortValue} onChange={(e) => onSortChange(e.target.value)}>
          {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </label>
    </div>
  );
}

/** Page numbers to render: first, last, current ±1, "…" for the gaps. */
function pageWindow(current, totalPages) {
  const out = [];
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - current) <= 1) {
      out.push(i);
    } else if (out[out.length - 1] !== "…") {
      out.push("…");
    }
  }
  return out;
}

function Pager({ page, totalPages, onChange }) {
  const { t } = useLanguage();
  if (totalPages <= 1) return null;

  return (
    <div className="lw-members__pager">
      <button
        aria-label={t("members.pagerPrev")} disabled={page === 0}
        onClick={() => onChange(page - 1)}
      ><ChevronLeft size={14} /></button>

      {pageWindow(page, totalPages).map((p, idx) => p === "…" ? (
        <span key={`gap-${idx}`} className="lw-members__pagergap">…</span>
      ) : (
        <button
          key={p} className={p === page ? "is-active" : ""}
          aria-current={p === page ? "page" : undefined}
          onClick={() => onChange(p)}
        >{p + 1}</button>
      ))}

      <button
        aria-label={t("members.pagerNext")} disabled={page === totalPages - 1}
        onClick={() => onChange(page + 1)}
      ><ChevronRight size={14} /></button>
    </div>
  );
}

function humanise(t, role) {
  return t(`roles.${role}`) !== `roles.${role}` ? t(`roles.${role}`) : role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function statusLabel(t, status) {
  const key = `members.status${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

const CSS = `
  .lw-members__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }

  /* ── Tabs ─────────────────────────────────────────────────────────────── */
  .lw-members__tabs { display: flex; align-items: center; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid var(--line); }
  .lw-members__tabs button {
    font-family: inherit; font-size: 0.85rem; font-weight: 600; color: var(--ink-soft);
    background: transparent; border: 1px solid var(--line); border-radius: 6px; border-bottom: 2px solid transparent;
    padding: 9px 14px; cursor: pointer; margin-bottom: -1px;
  }
  .lw-members__tabs button.is-active { color: var(--ink); border-bottom-color: var(--accent); }
  .lw-members__tabs button:hover:not(.is-active) { color: var(--ink); background: var(--surface-2, rgba(0,0,0,0.05)); }
  .lw-members__tabsrefresh {
    margin-inline-start: auto; display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; color: var(--ink-soft) !important; border-radius: 6px !important;
    padding: 0 !important;
  }
  .lw-members__tabsrefresh:hover:not(:disabled) { background: var(--surface-2); }
  .lw-members__tabsrefresh:disabled { opacity: 0.45; cursor: not-allowed; }

  /* UIC-003: one property per row — label left, value right. */
  .lw-members__form {
    display: grid; grid-template-columns: max-content 1fr; row-gap: 12px; column-gap: 16px; align-items: start;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px;
  }
  .lw-members__form > label, .lw-members__form > .lw-members__formrow { display: contents; }
  .lw-members__form label > span:first-child, .lw-members__form .lw-members__formrow > span:first-child {
    font-size: 0.78rem; font-weight: 600; padding-top: 9px; white-space: nowrap;
  }
  .lw-members__form input, .lw-members__form select, .lw-members__form textarea {
    width: 100%; font-family: var(--font-body); font-size: 0.88rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 8px 10px;
  }
  .lw-members__form textarea { resize: vertical; font-family: var(--font-mono); font-size: 0.82rem; }
  .lw-members__formactions { grid-column: 1 / -1; display: flex; gap: 8px; }
  @media (max-width: 480px) {
    .lw-members__form { grid-template-columns: 1fr; }
    .lw-members__form > label, .lw-members__form > .lw-members__formrow { display: flex; flex-direction: column; gap: 5px; }
    .lw-members__form label > span:first-child, .lw-members__form .lw-members__formrow > span:first-child { padding-top: 0; }
  }

  .lw-members__modetoggle { display: inline-flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; width: fit-content; }
  .lw-members__modetoggle button {
    font-family: var(--font-body); font-size: 0.82rem; color: var(--ink-soft);
    background: var(--bg); border: none; padding: 7px 12px; cursor: pointer;
  }
  .lw-members__modetoggle button + button { border-inline-start: 1px solid var(--line); }
  .lw-members__modetoggle button.is-active { background: var(--accent); color: #fff; }

  .lw-members__enroll { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .lw-members__radio {
    display: flex; align-items: center; gap: 7px; font-size: 0.85rem; color: var(--ink);
    cursor: pointer;
  }
  .lw-members__radio input[type="radio"] {
    width: auto; padding: 0; border: none; background: transparent; border-radius: 0;
  }
  .lw-members__enroll select {
    font-family: var(--font-body); font-size: 0.85rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 7px 9px; margin-inline-start: 21px;
  }

  .lw-members__templatelink {
    display: inline-flex; align-items: center; gap: 5px; margin-top: 8px;
    font-family: var(--font-body); font-size: 0.78rem; color: var(--ink-soft);
    background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; margin-inline-start: -6px; cursor: pointer;
  }
  .lw-members__templatelink:hover { color: var(--accent); text-decoration: underline; background: var(--surface-2, rgba(0,0,0,0.05)); }

  .lw-members__bulkpreview { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.8rem; color: var(--ink-soft); padding-top: 9px; }
  .lw-members__bulkpreview .is-warn { color: var(--danger); }
  .lw-members__bulkpreview .is-muted { font-style: italic; }

  .lw-members__toolbar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px;
  }
  .lw-members__searchbox {
    display: flex; align-items: center; gap: 9px; flex: 1; min-width: 220px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 9px 13px; color: var(--ink-soft); box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    transition: border-color 0.15s ease;
  }
  .lw-members__searchbox:focus-within { border-color: var(--accent); }
  .lw-members__searchbox input {
    flex: 1; border: none; background: transparent; font-family: var(--font-body);
    font-size: 0.9rem; color: var(--ink); outline: none;
  }
  .lw-members__searchbox input::-webkit-search-cancel-button { cursor: pointer; }
  .lw-members__sortbox { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .lw-members__sortbox span { font-size: 0.82rem; color: var(--ink-soft); white-space: nowrap; font-weight: 500; }
  .lw-members__sortbox select {
    font-family: var(--font-body); font-size: 0.88rem; color: var(--ink);
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 8px 12px;
  }

  .lw-members__list { display: flex; flex-direction: column; gap: 10px; }
  .lw-members__grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px; align-items: stretch;
  }
  .lw-members__grid--members { grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); }
  .lw-members__row {
    display: flex; align-items: center; gap: 14px;
    flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 16px 18px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: all 0.18s ease;
  }
  .lw-members__row:hover {
    border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
    box-shadow: 0 4px 14px rgba(0,0,0,0.04);
  }
  .lw-members__grid .lw-members__row { height: 100%; }

  .lw-members__pager { display: flex; align-items: center; gap: 6px; margin-top: 16px; }
  .lw-members__pager button {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 30px; height: 30px; font-family: var(--font-mono); font-size: 11.5px;
    background: var(--surface); color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 8px; padding: 0 8px; cursor: pointer;
    transition: all 0.15s ease;
  }
  .lw-members__pager button:hover:not(:disabled) { color: var(--ink); border-color: var(--accent); }
  .lw-members__pager button:disabled { opacity: 0.4; cursor: not-allowed; }
  .lw-members__pager button.is-active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }
  .lw-members__pagergap { color: var(--ink-soft); font-size: 11.5px; padding: 0 4px; }
  .lw-members__avatar {
    width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff;
    font-family: var(--font-display); font-weight: 700; font-size: 1.05rem;
    box-shadow: 0 2px 6px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .lw-members__avatar.is-pending { background: var(--surface-2); color: var(--ink-soft); box-shadow: none; }
  .lw-members__avatar.is-request { background: var(--accent-2); box-shadow: 0 2px 6px color-mix(in srgb, var(--accent-2) 30%, transparent); }
  .lw-members__msg {
    font-size: 0.84rem; color: var(--ink-soft); font-style: italic;
    margin-top: 6px; max-width: 52ch; line-height: 1.55;
  }

  .lw-members__who { flex: 1; min-width: 160px; }
  .lw-members__name { font-weight: 600; font-size: 0.96rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; overflow-wrap: anywhere; }
  .lw-members__owner {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    background: var(--accent-2); color: #fff; border-radius: 20px; padding: 2px 8px;
  }
  .lw-members__email { font-size: 0.82rem; color: var(--ink-soft); margin-top: 3px; overflow-wrap: anywhere; }
  .lw-members__course {
    display: inline-flex; align-items: center; margin-top: 6px;
    font-family: var(--font-mono); font-size: 10.5px; color: var(--accent-2);
    background: color-mix(in srgb, var(--accent-2) 12%, transparent);
    border-radius: 20px; padding: 3px 9px; font-weight: 500;
  }
  .lw-members__courses { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .lw-members__courses .lw-members__course { margin-top: 0; }
  .lw-members__course--pending { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
  .lw-members__roles { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .lw-members__role {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 500;
    background: var(--surface-2); color: var(--ink); border-radius: 20px; padding: 3px 9px;
  }
  .lw-members__role button {
    display: flex; background: transparent; border: 1px solid var(--line); border-radius: 50%; padding: 2px;
    color: var(--ink-soft); cursor: pointer; line-height: 0;
  }
  .lw-members__role button:hover { color: var(--danger); background: var(--surface-2, rgba(0,0,0,0.05)); }
  .lw-members__roleadd {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-mono); font-size: 10.5px;
    background: transparent; color: var(--ink-soft);
    border: 1px dashed var(--line); border-radius: 20px; padding: 3px 9px; cursor: pointer;
    transition: all 0.15s ease;
  }
  .lw-members__roleadd:hover { border-color: var(--accent); color: var(--accent); }
  .lw-members__rolepick {
    font-family: var(--font-body); font-size: 11.5px;
    background: var(--bg); color: var(--ink);
    border: 1px solid var(--accent); border-radius: 20px; padding: 3px 8px;
  }

  .lw-members__status {
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; flex-shrink: 0;
    border-radius: 20px; padding: 4px 10px;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-members__status.is-active { background: color-mix(in srgb, var(--accent-2) 18%, transparent); color: var(--accent-2); }
  .lw-members__status.is-suspended, .lw-members__status.is-pending, .lw-members__status.is-expired { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }

  .lw-members__actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
  .lw-members__actions button {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: var(--font-body); font-size: 11.5px; font-weight: 500;
    background: var(--surface-2); color: var(--ink);
    border: 1px solid var(--line); border-radius: 20px; padding: 4px 10px; cursor: pointer;
    transition: all 0.15s ease;
  }
  .lw-members__actions button:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
  .lw-members__actions button:disabled { opacity: 0.45; cursor: not-allowed; }

  .lw-members__enrollinline { display: inline-flex; align-items: center; gap: 6px; }
  .lw-members__enrollinline select {
    font-family: var(--font-body); font-size: 11.5px; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px;
    max-width: 160px;
  }
  .lw-members__enrollinline button {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-body); font-size: 11.5px;
    background: var(--surface-2); color: var(--ink);
    border: 1px solid var(--line); border-radius: 20px; padding: 4px 10px; cursor: pointer;
    transition: all 0.15s ease;
  }
  .lw-members__enrollinline button:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
  .lw-members__enrollinline button:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Groups the Create Invitation form's fields (Who / How / Enrollment /
     Recipients) without breaking the label-left/value-right grid the fields
     themselves rely on — this spans both grid columns instead of nesting. */
  .lw-members__formsection {
    grid-column: 1 / -1; display: flex; align-items: center; gap: 6px;
    font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--ink-soft); margin-top: 6px;
  }
  .lw-members__formsection:first-child { margin-top: 0; }
  .lw-members__formsection svg { color: var(--accent-2); flex-shrink: 0; }

  .lw-members__bulkresult {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px;
  }
  .lw-members__bulkresulthead {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    font-size: 0.85rem; font-weight: 600; margin-bottom: 10px;
  }
  .lw-members__bulkresulthead button {
    display: flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 6px; cursor: pointer;
  }
  .lw-members__bulkresulthead button:hover { color: var(--ink); }
  .lw-members__row--compact { padding: 8px 12px; }

  .lw-members__joinreq {
    display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 16px 18px;
  }
  .lw-members__joinreq.is-on {
    background: color-mix(in srgb, var(--accent-2) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent-2) 35%, transparent);
  }
  .lw-members__joinreqtitle { font-weight: 600; font-size: 0.95rem; }
  .lw-members__joinreq p { font-size: 0.83rem; color: var(--ink-soft); margin: 4px 0 0; max-width: 58ch; line-height: 1.55; }
  .lw-members__joinqr {
    display: flex; align-items: center; gap: 14px;
    width: 100%; padding-top: 14px; margin-top: 4px;
    border-top: 1px solid color-mix(in srgb, var(--accent-2) 25%, transparent);
  }
  .lw-members__joinqr img { border-radius: 8px; background: #fff; padding: 6px; border: 1px solid var(--line); flex-shrink: 0; }
  .lw-members__joinqrlabel { font-size: 0.78rem; font-weight: 600; color: var(--ink-soft); margin-bottom: 4px; }
  .lw-members__joinqr code { font-family: var(--font-mono); font-size: 0.82rem; word-break: break-all; }

  .lw-members__spin { animation: lwMemSpin 0.9s linear infinite; }
  @keyframes lwMemSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-members__spin { animation: none; } }
`;
