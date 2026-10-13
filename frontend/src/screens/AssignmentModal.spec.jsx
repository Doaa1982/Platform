import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: (key) => key, lang: "en" }) }));
vi.mock("../auth/authContext", () => ({ useAuth: () => ({ session: { token: "T" }, workspace: { slug: "al-noor" } }) }));
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal()),
  getAssignment: vi.fn(),
  configureAssignment: vi.fn(),
  assignmentTransition: vi.fn(),
}));

import * as api from "../api/client";
import { AssignmentModal } from "./ContentStudioScreen.jsx";

// A new assignment: Draft and never configured, so the backend still blocks publishing.
const draft = {
  id: "as1", learningActivityId: "ac1", learningProductId: "p1", status: "Draft",
  availabilityMode: "Immediate", scheduledAvailabilityAt: null, dueDateMode: "None", dueAt: null,
  submissionWindowStartAt: null, submissionWindowEndAt: null, attemptMode: "Single", maxAttempts: null,
  evaluationMethod: "Manual", visible: true, notifyOnPublish: true, notifyOnFeedbackPublished: true,
  configured: false, publicationBlocker: "Configure this assignment's availability, due date, attempts, and evaluation method before publishing.",
};

function open() {
  const onChanged = vi.fn();
  const { container } = render(<AssignmentModal lessonId="l1" activity={{ id: "ac1", title: "Worksheet" }} onClose={() => {}} onChanged={onChanged} />);
  return { container, onChanged };
}

async function setFixedDueDate(container) {
  await waitFor(() => expect(container.querySelector(".lw-studio__pill.is-draft")).not.toBeNull());
  const [, dueMode] = container.querySelectorAll("select");      // Availability, Due date, Attempts, Evaluation
  fireEvent.change(dueMode, { target: { value: "Fixed" } });
  fireEvent.change(container.querySelector('input[type="datetime-local"]'), { target: { value: "2026-11-01T09:00" } });
}

describe("Assign activity dialog: Publish", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("saves unsaved settings, then publishes, in one click", async () => {
    api.getAssignment.mockResolvedValue(draft);
    api.configureAssignment.mockImplementation(async (_t, _s, _l, _a, body) => ({ ...draft, ...body, configured: true, publicationBlocker: null }));
    api.assignmentTransition.mockImplementation(async () => ({ ...draft, dueDateMode: "Fixed", dueAt: "2026-11-01T09:00:00.000Z", configured: true, publicationBlocker: null, status: "Published" }));
    const { container, onChanged } = open();
    await setFixedDueDate(container);

    const publish = screen.getByRole("button", { name: /studio.publishAssignment/ });
    expect(publish.disabled).toBe(false);                     // was disabled until Save settings had run
    fireEvent.click(publish);

    await waitFor(() => expect(container.querySelector(".lw-studio__pill.is-published")).not.toBeNull());
    expect(api.configureAssignment).toHaveBeenCalledOnce();
    expect(api.configureAssignment.mock.calls[0][4]).toMatchObject({ dueDateMode: "Fixed", dueAt: new Date("2026-11-01T09:00").toISOString() });
    expect(api.assignmentTransition).toHaveBeenCalledWith("T", "al-noor", "l1", "ac1", "publish");
    expect(api.configureAssignment.mock.invocationCallOrder[0]).toBeLessThan(api.assignmentTransition.mock.invocationCallOrder[0]);
    expect(onChanged).toHaveBeenCalled();
  });

  it("publishes straight away when everything is already saved", async () => {
    const saved = { ...draft, configured: true, publicationBlocker: null };
    api.getAssignment.mockResolvedValue(saved);
    api.assignmentTransition.mockResolvedValue({ ...saved, status: "Published" });
    const { container } = open();
    await waitFor(() => expect(container.querySelector(".lw-studio__pill.is-draft")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /studio.publishAssignment/ }));
    await waitFor(() => expect(container.querySelector(".lw-studio__pill.is-published")).not.toBeNull());
    expect(api.configureAssignment).not.toHaveBeenCalled();
  });

  it("shows a failed save inline, in the dialog, and does not publish", async () => {
    api.getAssignment.mockResolvedValue(draft);
    api.configureAssignment.mockRejectedValue(Object.assign(new Error("A fixed due date needs a date."), { status: 400 }));
    const { container } = open();
    await setFixedDueDate(container);

    fireEvent.click(screen.getByRole("button", { name: /studio.publishAssignment/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("A fixed due date needs a date.");
    expect(alert.closest(".lw-modal__panel")).not.toBeNull();  // inside the dialog, not the corner toast
    expect(api.assignmentTransition).not.toHaveBeenCalled();
    expect(container.querySelector(".lw-studio__pill.is-draft")).not.toBeNull();
  });
});
