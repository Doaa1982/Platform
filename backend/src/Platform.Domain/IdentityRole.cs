namespace Platform.Domain;

/// <summary>
/// Represents the platform-level role of an Identity.
/// Roles are global (not Workspace-scoped) per Identity Aggregate Design, Section 7.
/// </summary>
public enum IdentityRole
{
    Tutor,
    Learner,
    Admin
}
