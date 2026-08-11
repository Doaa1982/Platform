namespace Platform.Api.Models;

/// <summary>Request body for POST /api/auth/forgot-password.</summary>
public record ForgotPasswordRequest(string Email);

/// <summary>
/// Response body for POST /api/auth/forgot-password.
///
/// Deliberately the same shape and wording whether or not the email belongs
/// to an account (login's INV-006 rule, applied here for the same reason: a
/// forgot-password form is the single easiest place to enumerate every
/// registered email address if it answers honestly).
/// </summary>
public record ForgotPasswordResponse(string Message);

/// <summary>
/// What the holder of a password reset link sees before choosing a new
/// password — resolved from the token alone, before any authentication.
///
/// Deliberately thin, mirroring InvitationPreview: anyone holding the link
/// sees this, so it carries only what is needed to show a sensible form.
/// </summary>
public record PasswordResetPreview(string Email, DateTime ExpiresAt);

/// <summary>Request body for POST /api/auth/reset-password/{token}.</summary>
public record ResetPasswordRequest(string NewPassword);
