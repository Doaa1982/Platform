namespace Platform.Api.Models;

/// <summary>A parent's details as typed (form, invitation, spreadsheet row). Language "ar"/"en", Arabic when blank.</summary>
public record ParentDetails(string Name, string Email, string? Language = null, string? WhatsAppPhone = null);

/// <summary>
/// One parent contact. Status is "Waiting", "Confirmed", "Unsubscribed" — or "Expired" for a
/// parent who didn't confirm within 14 days (the record is still waiting; the tutor can resend).
/// </summary>
public record ParentContactRow(
    Guid Id,
    Guid LearnerMembershipId,
    string Name,
    string Email,
    string Language,
    string? WhatsAppPhone,
    string Status,
    string Source,
    DateTime CreatedAt,
    DateTime ConfirmationExpiresAt,
    DateTime? ConfirmedAt,
    DateTime? UnsubscribedAt);

/// <summary>Every parent contact in a workspace, for the tutor's Members screen.</summary>
public record WorkspaceParentContactsResponse(bool CanManage, int MaxPerLearner, IReadOnlyList<ParentContactRow> Contacts);

/// <summary>A learner's own parent contacts.</summary>
public record MyParentContactsResponse(int MaxPerLearner, IReadOnlyList<ParentContactRow> Contacts);

/// <summary>Result of a public confirm/unsubscribe link. Status: "Confirmed", "Unsubscribed", "Invalid", "Expired".</summary>
public record ParentLinkResult(string Status, string? WorkspaceName, string? LearnerFirstName, string? Language);

public record ParentLinkRequest(string Token);

/// <summary>Workspace settings: the academy's two parent-report switches (both off by default).</summary>
public record SetParentReportsRequest(bool Results, bool MonthlySummary);

// ── Spreadsheet import ─────────────────────────────────────────────────────

/// <summary>
/// One spreadsheet row as the server read it. Problems are stable codes the UI translates:
/// studentEmailMissing, studentEmailInvalid, studentNotFound, duplicateStudent,
/// parentNameMissing, parentEmailInvalid, parentLanguageInvalid, parentPhoneInvalid,
/// duplicateParent, tooManyParents.
/// </summary>
public record ParentImportRow(
    int RowNumber,
    string StudentEmail,
    string? StudentName,
    Guid? LearnerMembershipId,
    IReadOnlyList<ParentDetails> Parents,
    IReadOnlyList<string> Problems)
{
    public bool Ok => Problems.Count == 0;
}

/// <summary>
/// "invite" previews a bulk invitation (students needn't exist yet); "existing" matches rows to
/// this workspace's learners by email. Nothing is saved by a preview. FileProblem is set (and Rows
/// empty) when the file itself couldn't be read: unreadableFile, missingStudentEmailColumn,
/// emptyFile, tooManyRows, fileTooLarge.
/// </summary>
public record ParentImportPreviewResponse(string Mode, IReadOnlyList<ParentImportRow> Rows, string? FileProblem);

/// <summary>The rows the tutor kept after the preview, for "Import parents" on existing students.</summary>
public record ParentImportCommitRequest(IReadOnlyList<ParentImportCommitRow> Rows);

public record ParentImportCommitRow(string StudentEmail, IReadOnlyList<ParentDetails> Parents);

/// <summary>Created and updated contacts; skipped rows didn't match a learner or broke a rule (with the codes why).</summary>
public record ParentImportResult(int Created, int Updated, int Skipped, IReadOnlyList<ParentImportRow> SkippedRows);
