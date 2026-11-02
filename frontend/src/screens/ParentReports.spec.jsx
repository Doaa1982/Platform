import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/* =========================================================================
   Parent progress reports (Parent Progress Reports Business Analysis):
   · the Parents panel in each state, and who may do what;
   · the two Workspace settings switches;
   · the invite form's optional Parents part, and what it sends;
   · the spreadsheet import preview (OK rows in, problem rows explained and kept out).
   t() returns the key (with its variables), so each check names the exact string shown.
   ========================================================================= */

const tr = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: tr, lang: "en", dir: "ltr", setLang: () => {} }) }));
vi.mock("../auth/authContext", () => ({ useAuth: () => ({ session: { token: "T" }, workspace: { slug: "al-noor" } }) }));
vi.mock("../theme/useTheme", () => ({ useTheme: () => ({ mode: "light" }) }));
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal()),
  getSetup: vi.fn(),
  setParentReports: vi.fn(),
  getMembers: vi.fn(),
  getJoinRequests: vi.fn(async () => []),
  getCourseJoinRequests: vi.fn(async () => []),
  getProducts: vi.fn(async () => ({ products: [] })),
  getParentContacts: vi.fn(),
  inviteMembersBulk: vi.fn(),
  previewParentImport: vi.fn(),
}));

import * as api from "../api/client";
import { ParentContactList } from "../components/ParentContacts";
import { ParentImportPreview } from "../components/ParentImport";
import WorkspaceSettingsScreen from "./WorkspaceSettingsScreen.jsx";
import MembersScreen from "./MembersScreen.jsx";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const contact = (extra) => ({
  id: "c1", learnerMembershipId: "m1", name: "Hala Ahmed", email: "hala@example.com", language: "ar",
  whatsAppPhone: null, status: "Waiting", source: "Tutor", createdAt: "2026-11-01T09:00:00Z",
  confirmationExpiresAt: "2026-11-15T09:00:00Z", confirmedAt: null, unsubscribedAt: null, ...extra,
});

describe("Parents panel", () => {
  it("labels every status, and offers resend only to a parent who hasn't confirmed", () => {
    render(<ParentContactList mode="tutor" max={2} contacts={[
      contact(), contact({ id: "c2", name: "Omar", email: "omar@example.com", status: "Confirmed" }),
    ]} onAdd={vi.fn()} onUpdate={vi.fn()} onResend={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText("parents.statusWaiting")).toBeTruthy();
    expect(screen.getByText("parents.statusConfirmed")).toBeTruthy();
    const [waitingRow, confirmedRow] = screen.getAllByRole("listitem");
    expect(within(waitingRow).getByRole("button", { name: /parents.resend/ })).toBeTruthy();
    expect(within(confirmedRow).queryByRole("button", { name: /parents.resend/ })).toBeNull();
    // Two parents is the limit: no "Add a parent", a note instead.
    expect(screen.queryByRole("button", { name: /parents.addParent/ })).toBeNull();
    expect(screen.getByText(/parents.maxReached/)).toBeTruthy();
  });

  it("explains an expired and an unsubscribed parent", () => {
    render(<ParentContactList mode="tutor" max={2} contacts={[
      contact({ status: "Expired" }), contact({ id: "c2", email: "o@example.com", status: "Unsubscribed" }),
    ]} onAdd={vi.fn()} onUpdate={vi.fn()} onResend={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("parents.statusExpired")).toBeTruthy();
    expect(screen.getByText("parents.expiredNote")).toBeTruthy();
    expect(screen.getByText("parents.unsubscribedNote")).toBeTruthy();
  });

  it("asks before removing, in the page (never window.confirm)", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const onRemove = vi.fn(async () => true);
    render(<ParentContactList mode="tutor" max={2} contacts={[contact()]}
                              onAdd={vi.fn()} onUpdate={vi.fn()} onResend={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: /parents.remove/ }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "parents.removeYes" }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" })));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("a learner sees no edit or resend, and the add form checks the fields before sending", async () => {
    const onAdd = vi.fn(async () => true);
    render(<ParentContactList mode="learner" max={2} contacts={[contact({ status: "Confirmed" })]} onAdd={onAdd} onRemove={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /parents.edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /parents.resend/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /parents.addParent/ }));
    fireEvent.click(screen.getByRole("button", { name: "parents.add" }));
    expect(screen.getByText("parents.errName")).toBeTruthy();
    expect(screen.getByText("parents.errEmail")).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("parents.name"), { target: { value: " Mona " } });
    fireEvent.change(screen.getByLabelText("parents.email"), { target: { value: "mona@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "parents.add" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ name: "Mona", email: "mona@example.com", language: "ar", whatsAppPhone: null }));
  });

  it("without change rights, shows the parents but no actions", () => {
    render(<ParentContactList mode="tutor" max={2} contacts={[contact()]} />);
    expect(screen.getByText("Hala Ahmed")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("Workspace settings: parent report switches", () => {
  const setup = (extra) => ({ canManage: true, emailParentsResults: false, emailParentsMonthlySummary: false, ...extra });

  it("starts off, and each switch saves on its own, keeping the other as it is", async () => {
    api.getSetup.mockResolvedValue(setup({ emailParentsMonthlySummary: true }));
    api.setParentReports.mockImplementation(async (_t, _s, next) => setup({ emailParentsResults: next.results, emailParentsMonthlySummary: next.monthlySummary }));
    render(<WorkspaceSettingsScreen />);

    const results = await screen.findByRole("switch", { name: "settings.parentResultsLabel" });
    const monthly = screen.getByRole("switch", { name: "settings.parentMonthlyLabel" });
    expect(results.getAttribute("aria-checked")).toBe("false");
    expect(monthly.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(results);
    await waitFor(() => expect(api.setParentReports).toHaveBeenCalledWith("T", "al-noor", { results: true, monthlySummary: true }));
    await waitFor(() => expect(results.getAttribute("aria-checked")).toBe("true"));
  });

  it("is read-only for someone who can't manage the workspace", async () => {
    api.getSetup.mockResolvedValue(setup({ canManage: false }));
    render(<WorkspaceSettingsScreen />);
    expect((await screen.findByRole("switch", { name: "settings.parentResultsLabel" })).disabled).toBe(true);
    expect(screen.getByText("settings.viewOnly")).toBeTruthy();
  });
});

describe("Invite form: optional parents per student", () => {
  async function openCreateTab() {
    api.getMembers.mockResolvedValue({ workspaceName: "Al Noor", workspaceSlug: "al-noor", canManage: true, members: [], invitations: [] });
    api.getSetup.mockResolvedValue({ slug: "al-noor", acceptsJoinRequests: false, canManage: true });
    api.getParentContacts.mockResolvedValue({ canManage: true, maxPerLearner: 2, contacts: [] });
    api.inviteMembersBulk.mockResolvedValue({ batchId: "b", totalRecipients: 2, issuedCount: 2, skippedCount: 0, results: [] });
    render(<MembersScreen initialTab="create" />);
    return screen.findByLabelText("members.bulkEmailsLabel");
  }

  it("sends each student's filled-in parents, and none for a student left without", async () => {
    fireEvent.change(await openCreateTab(), { target: { value: "kid1@example.com, kid2@example.com" } });

    const kid1 = document.querySelector("details.lw-members__invparentspart");
    kid1.open = true;
    fireEvent.click(within(kid1).getByRole("button", { name: /parents.addParent/ }));
    fireEvent.change(within(kid1).getByLabelText("parents.name"), { target: { value: "Hala" } });
    fireEvent.change(within(kid1).getByLabelText("parents.email"), { target: { value: "hala@example.com" } });
    fireEvent.change(within(kid1).getByLabelText("parents.language"), { target: { value: "en" } });

    fireEvent.click(screen.getByRole("button", { name: "members.bulkSend" }));
    await waitFor(() => expect(api.inviteMembersBulk).toHaveBeenCalled());
    expect(api.inviteMembersBulk.mock.calls[0][2].recipients).toEqual([
      { email: "kid1@example.com", parents: [{ name: "Hala", email: "hala@example.com", language: "en", whatsAppPhone: null }] },
      { email: "kid2@example.com" },
    ]);
  });

  it("won't send while a started parent is incomplete", async () => {
    fireEvent.change(await openCreateTab(), { target: { value: "kid1@example.com" } });
    const kid1 = document.querySelector("details.lw-members__invparentspart");
    kid1.open = true;
    fireEvent.click(within(kid1).getByRole("button", { name: /parents.addParent/ }));
    fireEvent.change(within(kid1).getByLabelText("parents.name"), { target: { value: "Hala" } });

    expect(screen.getByText("members.inviteParentsFix")).toBeTruthy();
    expect(screen.getByRole("button", { name: "members.bulkSend" }).disabled).toBe(true);
  });
});

describe("Spreadsheet import preview", () => {
  const preview = {
    mode: "existing", fileProblem: null, rows: [
      { rowNumber: 2, studentEmail: "sara@example.com", studentName: "Sara Ali", learnerMembershipId: "m1",
        parents: [{ name: "Hala", email: "hala@example.com", language: "ar", whatsAppPhone: null }], problems: [] },
      { rowNumber: 3, studentEmail: "nobody@example.com", studentName: null, learnerMembershipId: null,
        parents: [{ name: "Mona", email: "bad", language: "ar", whatsAppPhone: null }], problems: ["studentNotFound", "parentEmailInvalid"] },
    ],
  };

  it("ticks OK rows, and shows each problem translated on a row that can't be included", () => {
    const onToggle = vi.fn();
    render(<ParentImportPreview preview={preview} selected={new Set([2])} onToggle={onToggle} showStudentName />);
    const [okBox, badBox] = screen.getAllByRole("checkbox");
    expect(okBox.checked).toBe(true);
    expect(badBox.disabled).toBe(true);
    expect(screen.getByText("parentImport.problem.studentNotFound")).toBeTruthy();
    expect(screen.getByText("parentImport.problem.parentEmailInvalid")).toBeTruthy();
    expect(screen.getByText("Sara Ali")).toBeTruthy();
    fireEvent.click(okBox);
    expect(onToggle).toHaveBeenCalledWith(2);
  });

  it("explains a file it couldn't read instead of showing rows", () => {
    render(<ParentImportPreview preview={{ mode: "invite", rows: [], fileProblem: "missingStudentEmailColumn" }} selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe("parentImport.file.missingStudentEmailColumn");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
