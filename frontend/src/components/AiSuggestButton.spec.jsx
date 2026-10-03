import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: (key) => key, lang: "en" }) }));

import AiSuggestButton, { AiErrorNote } from "./AiSuggestButton.jsx";
import { AiAccessContext } from "../ai/aiAccessStore.js";

const FREE = {
  licenseStatus: "Active", aiCreditsRemaining: 200,
  entitlements: [
    { key: "profile:Learning", value: "Professional" }, { key: "profile:Assessment", value: "Foundation" },
    { key: "profile:Branding", value: "Foundation" }, { key: "profile:Analytics", value: "Foundation" },
  ],
};

function renderWith(ui, { subscription = FREE, navigate = vi.fn(), refresh = vi.fn() } = {}) {
  render(<AiAccessContext.Provider value={{ subscription, navigate, refresh }}>{ui}</AiAccessContext.Provider>);
  return { navigate, refresh };
}

describe("AiSuggestButton", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("calls the action when the workspace has this AI (Branding on Free, with credits)", () => {
    const onClick = vi.fn();
    renderWith(<AiSuggestButton domain="Branding" label="Suggest" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Suggest" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is locked when the plan doesn't include it: no call, and the note beside it links to Plans", () => {
    const onClick = vi.fn();
    const { navigate } = renderWith(<AiSuggestButton domain="Assessment" label="Suggest questions" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Suggest questions" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.disabled).toBe(false);                 // still focusable

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog").textContent).toContain("ai.notInPlan");
    fireEvent.click(screen.getByRole("button", { name: "ai.seePlans" }));
    expect(navigate).toHaveBeenCalledWith("plans");
  });

  it("points to AI credits when the balance is empty", () => {
    const { navigate } = renderWith(<AiSuggestButton domain="Learning" label="Suggest" onClick={vi.fn()} />,
      { subscription: { ...FREE, aiCreditsRemaining: 0 } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest" }));
    fireEvent.click(screen.getByRole("button", { name: "ai.getCredits" }));
    expect(navigate).toHaveBeenCalledWith("aiCredits");
  });

  it("blocks nothing outside a provider (learner side, or access unknown)", () => {
    const onClick = vi.fn();
    render(<AiSuggestButton domain="Assessment" label="Suggest" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Suggest" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("AiErrorNote", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("shows a refused call inline, in the reader's language, until dismissed, and re-reads access", () => {
    const onDismiss = vi.fn();
    const { refresh, navigate } = renderWith(
      <AiErrorNote error={{ status: 403, message: "English server text" }} domain="Branding" onDismiss={onDismiss} />);
    const note = screen.getByRole("alert");
    expect(note.textContent).toContain("ai.notInPlan");
    expect(note.textContent).not.toContain("English server text");
    expect(refresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "ai.seePlans" }));
    expect(navigate).toHaveBeenCalledWith("plans");
    fireEvent.click(screen.getByRole("button", { name: "ai.dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("sends a 402 to AI credits, and a plain failure to 'try again' with no link", () => {
    renderWith(<AiErrorNote error={{ status: 402, creditsExhausted: true }} domain="Learning" />);
    expect(screen.getByRole("alert").textContent).toContain("ai.noCredits");
    cleanup();
    renderWith(<AiErrorNote error={{ status: 409 }} domain="Learning" />);
    expect(screen.getByRole("alert").textContent).toContain("ai.failed");
    expect(screen.queryByRole("button", { name: /ai\./ })).toBeNull();
  });

  it("renders nothing without an error", () => {
    renderWith(<AiErrorNote error={null} domain="Learning" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
