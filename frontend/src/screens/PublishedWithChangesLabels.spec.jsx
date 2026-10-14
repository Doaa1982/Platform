import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: (key) => key, lang: "en" }) }));
vi.mock("../auth/authContext", () => ({ useAuth: () => ({ session: { token: "T" }, workspace: { slug: "math-for-all" } }) }));
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal()),
  getProducts: vi.fn(),
  getCurriculum: vi.fn(),
}));

import * as api from "../api/client";
import ProductsScreen from "./ProductsScreen.jsx";
import ContentStudioScreen from "./ContentStudioScreen.jsx";

const product = (extra) => ({
  id: "p1", title: "Algebra Basics", description: "Equations made easy.", category: "Math", tags: [],
  status: "Published", pacing: "SelfPaced", enrollmentMode: "Open", defaultLanguage: "en",
  createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z", publishedAt: "2026-10-01T10:00:00Z",
  hasCurriculum: true, curriculumHasUnpublishedChanges: false, requiresSequentialCompletion: false, coverImageAssetId: null, ...extra,
});
const curriculum = (extra) => ({
  id: "c1", learningProductId: "p1", productTitle: "Algebra Basics", productStatus: "Published", title: "Algebra Basics",
  status: "Published", canAuthor: true, publicationBlocker: null, requiresSequentialCompletion: false, draftOpen: false,
  units: [], unplacedLessons: [], ...extra,
});

describe("Published with unpublished changes", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("Learning Products says so, instead of 'Not published yet', while Edit Mode is on", async () => {
    api.getProducts.mockResolvedValue({ workspaceName: "Math for all", canAuthor: true, products: [product({ curriculumHasUnpublishedChanges: true })] });
    render(<ProductsScreen onOpenStudio={() => {}} />);
    expect(await screen.findByText("products.curriculumPublishedWithChanges")).toBeTruthy();
    expect(screen.queryByText("products.curriculumNotPublished")).toBeNull();
  });

  it("Learning Products shows plain Published with no draft open", async () => {
    api.getProducts.mockResolvedValue({ workspaceName: "Math for all", canAuthor: true, products: [product()] });
    render(<ProductsScreen onOpenStudio={() => {}} />);
    expect(await screen.findByText("products.curriculumPublished")).toBeTruthy();
  });

  it("Content Studio keeps Published, adds a Draft changes marker and a Publish changes button", async () => {
    api.getCurriculum.mockResolvedValue(curriculum({ draftOpen: true }));
    const { container } = render(<ContentStudioScreen productId="p1" onSelectProduct={() => {}} />);
    await waitFor(() => expect(container.querySelector(".lw-studio__pill.is-published")).not.toBeNull());
    expect(screen.getByText("studio.draftChanges")).toBeTruthy();
    expect(screen.getByRole("button", { name: /studio.publishChanges/ })).toBeTruthy();
    expect(screen.getByText("studio.draftOpenNotice")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /studio.editMode/ })).toBeNull();
  });

  it("Content Studio offers Edit Mode on a published course with no draft", async () => {
    api.getCurriculum.mockResolvedValue(curriculum());
    const { container } = render(<ContentStudioScreen productId="p1" onSelectProduct={() => {}} />);
    await waitFor(() => expect(container.querySelector(".lw-studio__pill.is-published")).not.toBeNull());
    expect(screen.getByRole("button", { name: /studio.editMode/ })).toBeTruthy();
    expect(screen.queryByText("studio.draftChanges")).toBeNull();
  });
});
