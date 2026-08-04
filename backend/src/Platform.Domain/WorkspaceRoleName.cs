namespace Platform.Domain;

/// <summary>
/// The role names assignable to a Membership within its Workspace.
/// Per Membership Aggregate Design, Section 7 (Workspace Role) and
/// Workspace Access Context, Section 4.4.
///
/// These are Workspace-scoped, NOT global to an Identity (INV-005: a role confers
/// no permission in any other Workspace). The same person may hold Teacher in one
/// Workspace and Learner in another.
/// </summary>
public enum WorkspaceRoleName
{
    Owner,
    Administrator,
    Teacher,
    AssistantTeacher,
    Learner,
    Parent,
    FinanceManager
}
