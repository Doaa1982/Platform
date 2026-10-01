/**
 * Turns an API failure into a message in the reader's language.
 *
 * The API's own error text is English prose written for developers and logs, so
 * screens never show it directly. Each screen says what a status code means in
 * its own context (`byStatus`: e.g. a 404 on a reset link means "this link has
 * expired"), and everything else falls back to a translated generic message for
 * that class of failure.
 *
 * @param {(key: string, vars?: object) => string} t
 * @param {{ status?: number }} error  an ApiError (status 0 = never reached the server)
 * @param {Record<number, string>} [byStatus]  translation keys for statuses this screen expects
 */
export function apiErrorMessage(t, error, byStatus = {}) {
  const status = error?.status;
  if (status != null && byStatus[status]) return t(byStatus[status]);
  if (status === 0) return t("errors.network");
  if (status === 429) return t("errors.rateLimited");
  if (status === 401) return t("errors.signedOut");
  if (status === 403) return t("errors.forbidden");
  if (status === 404) return t("errors.notFound");
  if (status >= 500) return t("errors.server");
  return t("errors.generic");
}
