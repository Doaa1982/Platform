import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LiveBanner } from "./WorkspaceHomeScreen.jsx";

const t = (key) => key;

describe("Overview live banner", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("links to and copies <origin>/join/<slug>, the public join page", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<LiveBanner setup={{ slug: "al-noor", name: "Al Noor" }} t={t} />);

    const link = screen.getByRole("link");
    expect(link.href).toBe(`${window.location.origin}/join/al-noor`);
    expect(link.textContent).toContain("/join/al-noor");

    fireEvent.click(screen.getByRole("button", { name: "home.copyLink" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/al-noor`));
  });

  it("does not double the slash for a slug stored with a leading one", () => {
    render(<LiveBanner setup={{ slug: "/arabic-g1", name: "G1" }} t={t} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/join/arabic-g1");
  });
});
