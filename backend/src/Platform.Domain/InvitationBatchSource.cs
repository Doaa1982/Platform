namespace Platform.Domain;

/// <summary>
/// How the recipients of an Invitation Batch were entered (Student Workspace
/// Access &amp; Admission Architecture §4).
/// </summary>
public enum InvitationBatchSource
{
    EmailList,
    CsvImport
}
