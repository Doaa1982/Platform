import { Compass } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import { EntryError } from "../components/EntryShell";

/* Any address the router doesn't know. Before this, an unknown path quietly
   rendered the landing page, so a mistyped or stale link looked like it had
   "worked" and sent people somewhere they didn't ask to go. */
export default function NotFoundScreen({ onHome }) {
  const { t } = useLanguage();
  return (
    <EntryError icon={Compass} title={t("entry.notFoundTitle")} lead={t("entry.notFoundBody")}
                actionLabel={t("entry.goHome")} onAction={onHome} />
  );
}
