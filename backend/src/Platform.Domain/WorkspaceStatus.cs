namespace Platform.Domain;

/// <summary>
/// Lifecycle status of a Workspace.
/// Per Workspace Aggregate Design, Section 15 (State Machine), which adopts the
/// Domain Language &amp; Business Ontology sequence as canonical — distinguishing
/// Private (configured, not publicly discoverable) from Published (publicly listed).
///
/// "Growing" is deliberately excluded: it is a maturity-model label, not a
/// lifecycle state (Section 15).
/// </summary>
public enum WorkspaceStatus
{
    Created,
    Configuring,
    Private,
    Published,
    Active,
    Suspended,
    Archived,
    Deleted
}
