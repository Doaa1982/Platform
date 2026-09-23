import { useAssetUrl } from "../hooks/useAssetUrl";

/** An <iframe> for a Learning Asset (an inline PDF). Renders nothing until the API has authorised the caller. */
export default function AssetFrame({ token, slug, assetId, title, ...frameProps }) {
  const { url } = useAssetUrl(token, slug, assetId);
  if (!url) return null;
  return <iframe src={url} title={title} {...frameProps} />;
}
