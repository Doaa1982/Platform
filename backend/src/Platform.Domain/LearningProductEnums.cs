namespace Platform.Domain;

/// <summary>
/// Publication status of a Learning Product.
/// Per Learning Product Aggregate Design §8 and §16.
///
///   Draft → UnderReview → Published → Archived
///
/// Publication of the Product is a distinct event from publication of its
/// Curriculum (§16): the Product's identity and status are independent of which
/// Curriculum edition is currently active.
/// </summary>
public enum LearningProductStatus
{
    Draft,
    UnderReview,
    Published,
    Archived
}

/// <summary>How learners move through the product (Product Settings, §8).</summary>
public enum PacingModel
{
    SelfPaced,
    CohortBased,
    InstructorLed
}

/// <summary>
/// A hint about how learners are expected to get in.
///
/// Descriptive only. Actual eligibility is Enrollment's to enforce
/// (Enrollment Aggregate Design, INV-002) — this records the tutor's intent,
/// it does not gate anything.
/// </summary>
public enum EnrollmentMode
{
    Open,
    InvitationOnly,
    ApprovalRequired
}
