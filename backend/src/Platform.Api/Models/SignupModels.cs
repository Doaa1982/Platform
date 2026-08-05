namespace Platform.Api.Models;

/// <summary>Applying to become a tutor. No payment, and no account, at this stage.</summary>
public record SubmitSignupRequest(string FullName, string Email, string? About);

/// <summary>
/// What the applicant is told after submitting — including their Signup Status
/// Link, which is how they check back (BA-008). They have no Identity, so there
/// is nothing to log in to.
/// </summary>
public record SignupSubmittedResponse(Guid RequestId, string StatusLink, bool Delivered);

/// <summary>
/// The applicant's own view of their application.
///
/// Deliberately shaped around §7.1's "What the Prospective Tutor Sees": each
/// status carries its own message, and a rejection reason appears only when the
/// reviewer marked it visible. Internal review notes never appear here.
/// </summary>
public record SignupStatusResponse(
    string FullName,
    string Email,
    string Status,
    string Headline,
    string Detail,
    /// <summary>True only while payment can still be attempted.</summary>
    bool CanPay,
    DateTime? PaymentWindowEndsAt,
    DateTime SubmittedAt);

/// <summary>One row of the Platform Administrator's application queue.</summary>
public record SignupRequestRow(
    Guid Id,
    string FullName,
    string Email,
    string? About,
    string Status,
    string Payment,
    DateTime SubmittedAt,
    DateTime? ReviewedAt,
    DateTime? PaymentWindowEndsAt,
    /// <summary>Set once §7.2 has run, so an approved-and-paid applicant is provisioned once.</summary>
    Guid? ProvisionedWorkspaceId);

/// <summary>
/// Rejecting an application. The reason is optional, and shown to the applicant
/// only when the reviewer explicitly says so (§8).
/// </summary>
public record RejectSignupRequest(string? Reason, bool ReasonVisible);
