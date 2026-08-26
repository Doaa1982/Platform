namespace Platform.Domain;

/// <summary>
/// Lifecycle of a Tutor Signup Request.
/// Per Platform Administrator Business Analysis §7.1 and §11.
///
///   Submitted → UnderReview → { Rejected | Approved }
///
/// No payment step lives here (2026-08-24 correction): applying to teach
/// never required committing to pay anything, and since a $0 Solo plan now
/// exists in the Commercial Domain, gating an approved application on a
/// payment confirmation stopped being honest — it doesn't know, and doesn't
/// need to know, which plan (free or paid) the applicant will eventually
/// choose. That commercial decision happens later, entirely separately, at
/// Subscription checkout once the Workspace exists
/// (<see cref="CommercialSubscriptionService"/>/<see cref="Subscription"/>).
/// Approved is exactly the old Paid state, renamed for honesty — the signal
/// an authorized Platform Operator now needs is only "should this Workspace
/// be provisioned" (§7.2), not "was payment settled."
///
/// Rejected is a deliberate decision about the applicant (BA-007) — the old
/// distinction from a payment-window lapsing (Expired) no longer applies
/// now that there is no payment window to lapse.
/// </summary>
public enum SignupRequestStatus
{
    Submitted,
    UnderReview,
    Rejected,
    Approved
}
