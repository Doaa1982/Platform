import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: (key) => key, lang: "en" }) }));
vi.mock("../auth/authContext", () => ({ useAuth: () => ({ session: { token: "T" } }) }));
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal()),
  getEmailPreviews: vi.fn(),
  getEmailPreview: vi.fn(),
}));

import * as api from "../api/client";
import AdminEmailPreviewsSection from "./AdminEmailPreviewsSection.jsx";

const preview = (template, language) => ({
  template, language, subject: `${template} ${language}`, fromDisplayName: "Teach Tandem", replyTo: null,
  html: `<!DOCTYPE html><html lang="${language}"><body>${template}</body></html>`, text: `${template} text`,
});

describe("AdminEmailPreviewsSection", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders the first template's HTML in a fully sandboxed iframe, and re-fetches when the language changes", async () => {
    api.getEmailPreviews.mockResolvedValue([{ template: "PasswordReset" }, { template: "SignupReceived" }]);
    api.getEmailPreview.mockImplementation(async (_t, template, language) => preview(template, language));
    const { container } = render(<AdminEmailPreviewsSection />);

    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    const frame = container.querySelector("iframe");
    expect(frame.getAttribute("sandbox")).toBe("");          // no scripts, no same-origin access
    expect(frame.getAttribute("srcdoc")).toContain("PasswordReset");
    expect(api.getEmailPreview).toHaveBeenLastCalledWith("T", "PasswordReset", "en");

    fireEvent.click(screen.getByText("العربية"));
    await waitFor(() => expect(api.getEmailPreview).toHaveBeenLastCalledWith("T", "PasswordReset", "ar"));
  });

  it("shows the plain-text version on request", async () => {
    api.getEmailPreviews.mockResolvedValue([{ template: "PasswordReset" }]);
    api.getEmailPreview.mockImplementation(async (_t, template, language) => preview(template, language));
    const { container } = render(<AdminEmailPreviewsSection />);
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());

    fireEvent.click(screen.getByText("admin.emailPreviewsPlainText"));

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("pre").textContent).toBe("PasswordReset text");
  });
});

describe("API client language header", () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it("sends the in-app language as Accept-Language", async () => {
    const actual = await vi.importActual("../api/client");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("platform.lang", "ar");

    await actual.setMyLanguage("T", "ar");

    expect(fetchMock.mock.calls[0][1].headers["Accept-Language"]).toBe("ar");
  });
});
