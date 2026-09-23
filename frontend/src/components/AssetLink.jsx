import { useState } from "react";
import { assetUrls, assetUrlKey } from "../api/assetUrls";
import * as api from "../api/client";
import Message from "./Message";

/**
 * A download link for a Learning Asset. The short-lived URL is requested when the link is clicked (not when it is
 * rendered), so a long list of links costs nothing until someone uses one, and the URL is always fresh.
 * Navigating to an attachment downloads it without leaving the page.
 */
export default function AssetLink({ token, slug, assetId, children, onClick, ...anchorProps }) {
  const [error, setError] = useState(null);

  async function open(event) {
    event.preventDefault();
    setError(null);
    onClick?.(event);
    try {
      const { url } = await assetUrls.get(
        assetUrlKey(token, slug, assetId, true),
        () => api.requestLearningAssetAccess(token, slug, assetId, { download: true }),
      );
      window.location.assign(url);
    } catch (e) {
      setError(e.status === 403 || e.status === 404 ? "You no longer have access to this file." : e.message);
    }
  }

  return (
    <>
      <a href="#download" {...anchorProps} onClick={open}>{children}</a>
      {error && <Message type="error">{error}</Message>}
    </>
  );
}
