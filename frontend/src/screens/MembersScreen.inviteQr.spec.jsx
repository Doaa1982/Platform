import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: (key) => key }) }));

import { InviteLinkActions } from "./MembersScreen.jsx";

describe("InviteLinkActions", () => {
  afterEach(cleanup);

  it("shows a locally generated QR code and a WhatsApp share link for the invitation", async () => {
    render(<InviteLinkActions path="/invite/TOKEN123" email="sara@example.com" />);

    fireEvent.click(screen.getByText("members.inviteShowQr"));

    const img = await waitFor(() => screen.getByAltText("members.inviteQrAlt"));
    expect(img.getAttribute("src")).toMatch(/^data:image\/png;base64,/); // never a third-party QR service

    const whatsapp = screen.getByText("members.inviteQrWhatsapp").closest("a");
    expect(whatsapp.getAttribute("href")).toContain("https://wa.me/?text=");
    expect(decodeURIComponent(whatsapp.getAttribute("href"))).toContain(`${window.location.origin}/invite/TOKEN123`);

    const download = screen.getByText("members.inviteQrDownload").closest("a");
    expect(download.getAttribute("download")).toBe("invitation-sara@example.com.png");
  });

  it("copies the absolute invitation link", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<InviteLinkActions path="/invite/TOKEN123" email="sara@example.com" />);

    fireEvent.click(screen.getByText("members.inviteCopyLink"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/TOKEN123`));
    expect(await screen.findByText("members.inviteCopied")).toBeTruthy();
  });
});
