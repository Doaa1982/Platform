import { useEffect } from "react";

/* Caveat and Kalam added for the notebook theme (Tutor and Student headings
   respectively — see App.jsx's TUTOR_SHARED / STUDENT_SHARED token sets);
   Lora added for the Tutor ("Leather Ledger") body copy. Every family already
   in use elsewhere (Fraunces, Karla, Space Grotesk, IBM Plex Sans/Mono) is
   kept — this is additive, not a replacement. */
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Karla:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Caveat:wght@500;600;700&family=Kalam:wght@400;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap";

/** Injects the shared web fonts once, no matter how many components ask. */
export function useFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}
