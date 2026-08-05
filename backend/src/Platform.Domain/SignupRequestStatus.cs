namespace Platform.Domain;

/// <summary>
/// Lifecycle of a Tutor Signup Request.
/// Per Platform Administrator Business Analysis §7.1 and §11.
///
///   Submitted → UnderReview → { Rejected
///                             | ApprovedAwaitingPayment → { Paid
///                                                         | PaymentFailed → { Paid | Expired }
///                                                         | Expired } }
///
/// Rejected and Expired are deliberately distinct terminal states rather than
/// one "declined" (BA-007). Telling an applicant whose card was merely declined
/// that their *application* was rejected is both inaccurate and needlessly
/// discouraging — and the two carry different applicant-facing messages and
/// different reapplication consequences.
/// </summary>
public enum SignupRequestStatus
{
    Submitted,
    UnderReview,
    Rejected,
    ApprovedAwaitingPayment,
    PaymentFailed,
    Paid,
    Expired
}

/// <summary>
/// The Platform Subscription payment attempt tracked on a Signup Request
/// (Platform Administrator Business Analysis §4).
///
/// Kept separate from the request's own status because they answer different
/// questions: the status is where the application stands, this is what the
/// payment processor last said. Only the processor call itself is external
/// (BA-006).
/// </summary>
public enum PaymentStatus
{
    NotStarted,
    Pending,
    Failed,
    Succeeded
}
