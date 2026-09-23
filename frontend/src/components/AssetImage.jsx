import { useAssetUrl } from "../hooks/useAssetUrl";

/**
 * An <img> for a Learning Asset. Renders nothing until the API has authorised the caller; nothing if it refuses.
 * `batch` is for Image-category assets (covers, logos) on list screens, so many share one request.
 */
export default function AssetImage({ token, slug, assetId, alt = "", batch = false, ...imgProps }) {
  const { url } = useAssetUrl(token, slug, assetId, { batch });
  if (!url) return null;
  return <img src={url} alt={alt} {...imgProps} />;
}
