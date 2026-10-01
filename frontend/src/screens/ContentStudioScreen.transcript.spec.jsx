import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: (key) => key }) }));
vi.mock("../auth/authContext", () => ({
  useAuth: () => ({ session: { token: "T" }, workspace: { slug: "ws" } }),
}));
vi.mock("../components/VideoPlayer", () => ({ default: () => null }));
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal()),
  getTranscriptionCost: vi.fn(),
  generateLessonTranscript: vi.fn(),
  enhanceLessonTranscript: vi.fn(),
}));

import * as api from "../api/client";
import { VideoSection } from "./ContentStudioScreen.jsx";

/**
 * Covers the redesigned transcript panel (ContentStudioScreen's biggest, most independently
 * testable piece): the mode-card create flow, the collapsed "ready" summary, and the Redo/Edit/
 * Improve actions that reveal more of it. Renders VideoSection directly (exported for exactly
 * this) rather than the whole screen, with VideoPlayer stubbed out — media playback isn't what's
 * under test here.
 */
function makeLesson(revisionOverrides = {}) {
  return {
    id: "lesson-1",
    draftRevision: {
      id: "rev-1",
      video: null,
      videoUrl: "https://example.test/lesson.mp4", // any truthy source makes hasVideo true
      transcriptStatus: "None",
      transcriptSource: "None",
      transcriptInputMode: null,
      transcriptError: null,
      enhancementStatus: "None",
      enhancedTranscript: null,
      ...revisionOverrides,
    },
    currentRevision: null,
  };
}

function renderPanel({ revisionOverrides, transcript = "", setTranscript = vi.fn(), ...rest } = {}) {
  const lesson = makeLesson(revisionOverrides);
  const props = {
    lesson, editable: true, hasDraft: true, deliveryMode: "Recorded", publishAttempted: false,
    onChanged: vi.fn(), onDurationKnown: vi.fn(), onRequestNewVersion: vi.fn(),
    transcript, setTranscript, ...rest,
  };
  return { ...render(<VideoSection {...props} />), lesson, props };
}

const costSpan = (container, mode) => container.querySelector(`.lw-transcriptcard:nth-of-type(${mode === "Audio" ? 1 : 2}) .lw-transcriptcard__cost`);

/** The ready-state title ("Transcript ✓ Ready · mode · language") is one element with an icon and
 * a joined mode/language string inside it — not matchable by RTL's getByText (its own text is
 * split/joined across children), so tests read it directly via its class instead. */
const readyTitle = (container) => container.querySelector(".lw-transcriptready__title");

describe("VideoSection transcript panel — no transcript yet", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("shows both mode cards with their live AI-credit cost, and lets the tutor pick one", async () => {
    api.getTranscriptionCost.mockResolvedValue({ audioCredits: 40, videoLowResCredits: 120 });
    const { container } = renderPanel();

    await waitFor(() => expect(costSpan(container, "Audio")?.textContent).toBe("40 subscription.aiCreditsUnit"));
    expect(costSpan(container, "VideoLowRes")?.textContent).toBe("120 subscription.aiCreditsUnit");

    const audioCard = screen.getByText("studio.transcriptInputModeAudio").closest("button");
    const lowResCard = screen.getByText("studio.transcriptInputModeVideoLowRes").closest("button");
    expect(audioCard.className).toContain("lw-transcriptcard--selected"); // Audio is the default
    expect(lowResCard.className).not.toContain("lw-transcriptcard--selected");

    fireEvent.click(lowResCard);
    expect(lowResCard.className).toContain("lw-transcriptcard--selected");
    expect(audioCard.className).not.toContain("lw-transcriptcard--selected");
  });

  it("Create transcript sends the selected mode and language", async () => {
    api.getTranscriptionCost.mockResolvedValue({ audioCredits: 40, videoLowResCredits: 120 });
    api.generateLessonTranscript.mockResolvedValue({});
    renderPanel();

    fireEvent.click(screen.getByText("studio.transcriptInputModeVideoLowRes").closest("button"));
    fireEvent.change(screen.getByTitle("studio.transcriptLanguageHint"), { target: { value: "ar" } });
    fireEvent.click(screen.getByText("studio.generateTranscript").closest("button"));

    await waitFor(() => expect(api.generateLessonTranscript).toHaveBeenCalledWith("T", "ws", "lesson-1", "ar", "VideoLowRes"));
  });

  it("while a request is in flight, the button shows a busy state and the cards/language are disabled", async () => {
    api.getTranscriptionCost.mockResolvedValue({ audioCredits: 40, videoLowResCredits: 120 });
    let resolveCall;
    api.generateLessonTranscript.mockReturnValue(new Promise((resolve) => { resolveCall = resolve; }));
    renderPanel();

    fireEvent.click(screen.getByText("studio.generateTranscript").closest("button"));

    expect(await screen.findByText("studio.transcriptCreating")).toBeTruthy();
    expect(screen.getByText("studio.transcriptInputModeAudio").closest("button").disabled).toBe(true);
    expect(screen.getByTitle("studio.transcriptLanguageHint").disabled).toBe(true);

    await act(async () => { resolveCall({}); });
  });

  it("a Failed attempt shows the error and offers Try again instead of Create transcript", async () => {
    api.getTranscriptionCost.mockResolvedValue({ audioCredits: 40, videoLowResCredits: 120 });
    renderPanel({ revisionOverrides: { transcriptStatus: "Failed", transcriptError: "No speech detected." } });

    expect(await screen.findByText("No speech detected.")).toBeTruthy();
    expect(screen.getByText("studio.retryTranscript")).toBeTruthy();
    expect(screen.queryByText("studio.generateTranscript")).toBeNull();
  });
});

describe("VideoSection transcript panel — transcript ready", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("hides the mode cards and shows a short ready summary instead", async () => {
    api.getTranscriptionCost.mockResolvedValue({ audioCredits: 40, videoLowResCredits: 120 });
    const { container } = renderPanel({
      revisionOverrides: { transcriptStatus: "Ready", transcriptSource: "Automatic", transcriptInputMode: "VideoLowRes" },
      transcript: "S1: Hello there.",
    });

    await waitFor(() => expect(readyTitle(container)).not.toBeNull());
    expect(screen.queryByText("studio.transcriptInputModeAudio")).toBeNull(); // cards gone
    expect(screen.queryByText("S1: Hello there.")).toBeNull(); // box collapsed behind Edit
    const titleText = readyTitle(container).textContent;
    expect(titleText).toContain("studio.transcriptReadyLabel");
    expect(titleText).toContain("studio.transcriptInputModeUsedVideoLowRes"); // the mode that actually ran (server-side)
    expect(titleText).toContain("studio.transcriptLanguageAuto"); // default language state
  });

  it("Edit reveals the editable transcript box with dir=\"auto\"", async () => {
    api.getTranscriptionCost.mockResolvedValue({ audioCredits: 40, videoLowResCredits: 120 });
    const { container } = renderPanel({
      revisionOverrides: { transcriptStatus: "Ready", transcriptInputMode: "Audio" },
      transcript: "S1: Hello there.",
    });
    await waitFor(() => expect(readyTitle(container)).not.toBeNull());

    expect(screen.queryByDisplayValue("S1: Hello there.")).toBeNull();
    fireEvent.click(screen.getByText("studio.transcriptEdit").closest("button"));

    const box = screen.getByDisplayValue("S1: Hello there.");
    expect(box.getAttribute("dir")).toBe("auto");
  });

  it("Redo reveals the mode cards again with a replace-warning, and does not touch the stored transcript until re-submitted", async () => {
    api.getTranscriptionCost.mockResolvedValue({ audioCredits: 40, videoLowResCredits: 120 });
    const { container } = renderPanel({
      revisionOverrides: { transcriptStatus: "Ready", transcriptInputMode: "Audio" },
      transcript: "S1: Hello there.",
    });
    await waitFor(() => expect(readyTitle(container)).not.toBeNull());

    fireEvent.click(screen.getByText("studio.transcriptRedo").closest("button"));

    expect(screen.getByText("studio.transcriptRedoWarning")).toBeTruthy();
    expect(screen.getByText("studio.transcriptInputModeAudio")).toBeTruthy();
    expect(screen.getByText("studio.generateTranscript")).toBeTruthy();
    expect(api.generateLessonTranscript).not.toHaveBeenCalled();
  });

  it("Improve with AI asks for confirmation before calling the enhancement API", async () => {
    api.getTranscriptionCost.mockResolvedValue({ audioCredits: 40, videoLowResCredits: 120 });
    api.enhanceLessonTranscript.mockResolvedValue({});
    const { container } = renderPanel({
      revisionOverrides: { transcriptStatus: "Ready", transcriptInputMode: "Audio" },
      transcript: "S1: Hello there.",
    });
    await waitFor(() => expect(readyTitle(container)).not.toBeNull());

    fireEvent.click(screen.getByText("studio.transcriptImproveWithAi").closest("button"));
    expect(api.enhanceLessonTranscript).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("studio.enhanceTranscriptConfirmYes"));
    await waitFor(() => expect(api.enhanceLessonTranscript).toHaveBeenCalledWith("T", "ws", "lesson-1"));
  });
});
