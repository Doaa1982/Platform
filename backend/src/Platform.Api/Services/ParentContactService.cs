using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Parent contacts: who they are, how they get added, and the public confirm/unsubscribe links
/// (Parent Progress Reports Business Analysis §5–§7).
///
/// Three ways in, one record: the tutor (Members screen, or a spreadsheet import for existing
/// students), the learner (their own "My parents" page), and an invitation (parent details stored
/// with it become contacts only when the student accepts). Every new or re-invited contact gets
/// the same confirmation email, sent after the save.
///
/// Rules that span rows live here: at most <see cref="ParentContact.MaxPerLearner"/> contacts per
/// learner, no duplicate email per learner, and a contact is only ever reachable through its own
/// workspace (another workspace's tutor gets 404, as for members).
/// </summary>
public class ParentContactService(
    PlatformDbContext db,
    ParentReportService reports,
    ParentLinkTokens links,
    TimeProvider clock,
    ILogger<ParentContactService> logger)
{
    /// <summary>Same as the Members screen: owners and administrators manage; everyone else may look.</summary>
    private static readonly WorkspaceRoleName[] ManagerRoles = [WorkspaceRoleName.Owner, WorkspaceRoleName.Administrator];

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    // ── Tutor ────────────────────────────────────────────────────────────────

    public async Task<ProvisioningResult<WorkspaceParentContactsResponse>> ListForWorkspaceAsync(
        string slug, Guid caller, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: false, ct);
        if (ctx.Error is not null) return Fail<WorkspaceParentContactsResponse>(ctx.Error.Value);
        if (!ctx.CanManage && !ctx.IsTutor) return Fail<WorkspaceParentContactsResponse>((ProvisioningError.Forbidden, "Only the academy's staff can see parent contacts."));

        var contacts = await db.ParentContacts.AsNoTracking()
            .Where(c => c.WorkspaceId == ctx.Workspace!.Id && c.Status != ParentContactStatus.Removed)
            .OrderBy(c => c.CreatedAt).ToListAsync(ct);
        return ProvisioningResult<WorkspaceParentContactsResponse>.Success(
            new WorkspaceParentContactsResponse(ctx.CanManage, ParentContact.MaxPerLearner, contacts.Select(Describe).ToList()));
    }

    public async Task<ProvisioningResult<ParentContactRow>> AddForLearnerAsync(
        string slug, Guid caller, Guid learnerMembershipId, ParentDetails details, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: true, ct);
        if (ctx.Error is not null) return Fail<ParentContactRow>(ctx.Error.Value);
        if (!await IsActiveLearnerAsync(ctx.Workspace!.Id, learnerMembershipId, ct))
            return Fail<ParentContactRow>((ProvisioningError.NotFound, "No such learner in this workspace."));
        return await AddAsync(ctx.Workspace.Id, learnerMembershipId, details, ParentContactSource.Tutor, ct);
    }

    public async Task<ProvisioningResult<ParentContactRow>> UpdateAsync(
        string slug, Guid caller, Guid contactId, ParentDetails details, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: true, ct);
        if (ctx.Error is not null) return Fail<ParentContactRow>(ctx.Error.Value);

        var contact = await FindAsync(ctx.Workspace!.Id, contactId, ct);
        if (contact is null) return Fail<ParentContactRow>((ProvisioningError.NotFound, "No such parent contact."));

        var email = ParentContact.NormalizeEmail(details.Email);
        if (email != contact.Email && await HasActiveContactWithEmailAsync(contact.LearnerMembershipId, email, ct))
            return Fail<ParentContactRow>((ProvisioningError.Conflict, "This learner already has a parent with that email."));

        bool needsConfirmation;
        try { needsConfirmation = contact.Update(details.Name, details.Email, details.Language, details.WhatsAppPhone, Now); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        { return Fail<ParentContactRow>((ProvisioningError.Invalid, ex.Message)); }

        await db.SaveChangesAsync(ct);
        if (needsConfirmation) await reports.SendConfirmationAsync(contact, ct);
        return ProvisioningResult<ParentContactRow>.Success(Describe(contact));
    }

    /// <summary>Sends the confirmation again — after an unsubscribe, or when the parent never confirmed. A new link retires the old one.</summary>
    public async Task<ProvisioningResult<ParentContactRow>> ResendAsync(
        string slug, Guid caller, Guid contactId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: true, ct);
        if (ctx.Error is not null) return Fail<ParentContactRow>(ctx.Error.Value);

        var contact = await FindAsync(ctx.Workspace!.Id, contactId, ct);
        if (contact is null) return Fail<ParentContactRow>((ProvisioningError.NotFound, "No such parent contact."));

        try { contact.Reinvite(Now); }
        catch (InvalidOperationException ex) { return Fail<ParentContactRow>((ProvisioningError.Conflict, ex.Message)); }

        await db.SaveChangesAsync(ct);
        await reports.SendConfirmationAsync(contact, ct);
        return ProvisioningResult<ParentContactRow>.Success(Describe(contact));
    }

    public async Task<ProvisioningResult<string>> RemoveAsync(string slug, Guid caller, Guid contactId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: true, ct);
        if (ctx.Error is not null) return Fail<string>(ctx.Error.Value);

        var contact = await FindAsync(ctx.Workspace!.Id, contactId, ct);
        if (contact is null) return Fail<string>((ProvisioningError.NotFound, "No such parent contact."));

        contact.Remove(Now);
        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(contact.Status.ToString());
    }

    // ── Learner (their own parents only) ─────────────────────────────────────

    public async Task<ProvisioningResult<MyParentContactsResponse>> ListMineAsync(string slug, Guid caller, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: false, ct);
        if (ctx.Error is not null) return Fail<MyParentContactsResponse>(ctx.Error.Value);
        if (!ctx.IsLearner) return Fail<MyParentContactsResponse>((ProvisioningError.Forbidden, "Only a learner has parent contacts."));

        var contacts = await db.ParentContacts.AsNoTracking()
            .Where(c => c.LearnerMembershipId == ctx.MembershipId && c.Status != ParentContactStatus.Removed)
            .OrderBy(c => c.CreatedAt).ToListAsync(ct);
        return ProvisioningResult<MyParentContactsResponse>.Success(
            new MyParentContactsResponse(ParentContact.MaxPerLearner, contacts.Select(Describe).ToList()));
    }

    public async Task<ProvisioningResult<ParentContactRow>> AddMineAsync(string slug, Guid caller, ParentDetails details, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: false, ct);
        if (ctx.Error is not null) return Fail<ParentContactRow>(ctx.Error.Value);
        if (!ctx.IsLearner) return Fail<ParentContactRow>((ProvisioningError.Forbidden, "Only a learner can add their own parents."));
        return await AddAsync(ctx.Workspace!.Id, ctx.MembershipId, details, ParentContactSource.Learner, ct);
    }

    public async Task<ProvisioningResult<string>> RemoveMineAsync(string slug, Guid caller, Guid contactId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: false, ct);
        if (ctx.Error is not null) return Fail<string>(ctx.Error.Value);

        // Someone else's contact looks exactly like one that doesn't exist.
        var contact = await db.ParentContacts.FirstOrDefaultAsync(
            c => c.Id == contactId && c.LearnerMembershipId == ctx.MembershipId && c.Status != ParentContactStatus.Removed, ct);
        if (contact is null) return Fail<string>((ProvisioningError.NotFound, "No such parent contact."));

        contact.Remove(Now);
        await db.SaveChangesAsync(ct);
        return ProvisioningResult<string>.Success(contact.Status.ToString());
    }

    // ── Invitations ──────────────────────────────────────────────────────────

    /// <summary>
    /// Validates parent details typed into an invitation, the same way a contact would be — so
    /// acceptance never fails on them. Returns the problem codes (empty = fine).
    /// </summary>
    public static List<string> ValidateForInvitation(IReadOnlyList<ParentDetails>? parents)
    {
        var problems = new List<string>();
        if (parents is null || parents.Count == 0) return problems;
        if (parents.Count > ParentContact.MaxPerLearner) problems.Add("tooManyParents");
        if (parents.Select(p => ParentContact.NormalizeEmail(p.Email)).Distinct().Count() != parents.Count) problems.Add("duplicateParent");
        foreach (var p in parents) problems.AddRange(ProblemsOf(p));
        return problems.Distinct().ToList();
    }

    /// <summary>Stores invitation parent details (already validated). The caller saves.</summary>
    public void AttachToInvitation(Invitation invitation, IReadOnlyList<ParentDetails>? parents)
    {
        foreach (var p in parents ?? [])
            db.InvitationParentContacts.Add(InvitationParentContact.Create(
                invitation.Id, invitation.WorkspaceId, p.Name, p.Email, NormalizeLanguage(p.Language), p.WhatsAppPhone, Now));
    }

    /// <summary>Cancelled, or resent after expiring: the stored parent details are discarded. The caller saves.</summary>
    public async Task DiscardForInvitationAsync(Guid invitationId, CancellationToken ct)
    {
        var rows = await db.InvitationParentContacts.Where(p => p.InvitationId == invitationId).ToListAsync(ct);
        db.InvitationParentContacts.RemoveRange(rows);
    }

    /// <summary>
    /// The student accepted and their Membership is Active: the parent details stored with the
    /// invitation become contacts, and only now do the parents get the confirmation email.
    /// Called after acceptance has been saved. Never throws — joining must not fail over a parent.
    /// </summary>
    public async Task CreateFromAcceptedInvitationAsync(Guid invitationId, Guid learnerMembershipId, CancellationToken ct = default)
    {
        try
        {
            var pending = await db.InvitationParentContacts.Where(p => p.InvitationId == invitationId).ToListAsync(ct);
            if (pending.Count == 0) return;

            var created = new List<ParentContact>();
            var existing = await ActiveContactsAsync(learnerMembershipId, ct);
            foreach (var p in pending)
            {
                if (existing.Count + created.Count >= ParentContact.MaxPerLearner) break;
                if (existing.Any(c => c.Email == p.Email) || created.Any(c => c.Email == p.Email)) continue;
                var contact = ParentContact.Create(p.WorkspaceId, learnerMembershipId, p.Name, p.Email, p.Language, p.WhatsAppPhone, ParentContactSource.Invitation, Now);
                db.ParentContacts.Add(contact);
                created.Add(contact);
            }
            db.InvitationParentContacts.RemoveRange(pending);
            await db.SaveChangesAsync(ct);

            foreach (var contact in created) await reports.SendConfirmationAsync(contact, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The student is in regardless; the tutor can still add parents from the Members screen.
            logger.LogError(ex, "Could not create parent contacts from invitation {InvitationId}.", invitationId);
            db.ChangeTracker.Clear();
        }
    }

    // ── Spreadsheet import ───────────────────────────────────────────────────

    public static readonly string[] Columns =
        ["student_email", "parent1_name", "parent1_email", "parent1_whatsapp", "parent1_language",
         "parent2_name", "parent2_email", "parent2_whatsapp", "parent2_language"];

    /// <summary>
    /// Reads a spreadsheet and reports every row's problems. Saves nothing. "invite" checks the
    /// rows for a bulk invitation; "existing" also matches each row to a learner in this
    /// workspace by email and counts the parents they already have.
    /// </summary>
    public async Task<ProvisioningResult<ParentImportPreviewResponse>> PreviewImportAsync(
        string slug, Guid caller, string mode, Stream file, string fileName, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: true, ct);
        if (ctx.Error is not null) return Fail<ParentImportPreviewResponse>(ctx.Error.Value);
        if (mode is not ("invite" or "existing")) return Fail<ParentImportPreviewResponse>((ProvisioningError.Invalid, "Mode must be \"invite\" or \"existing\"."));

        List<string[]> table;
        try { table = SpreadsheetReader.Read(file, fileName); }
        catch (SpreadsheetException ex) { return Preview(mode, [], ex.Message); }

        if (table.Count == 0) return Preview(mode, [], "emptyFile");
        var header = table[0].Select(h => h.Trim().ToLowerInvariant().Replace(' ', '_')).ToArray();
        var col = Columns.ToDictionary(c => c, c => Array.IndexOf(header, c));
        if (col["student_email"] < 0) return Preview(mode, [], "missingStudentEmailColumn");

        string Cell(string[] row, string name) => col[name] is var i and >= 0 && i < row.Length ? row[i].Trim() : "";

        var parsed = table.Skip(1).Select((row, i) => (RowNumber: i + 2, StudentEmail: ParentContact.NormalizeEmail(Cell(row, "student_email")),
            Parents: new[] { 1, 2 }
                .Select(n => new ParentDetails(Cell(row, $"parent{n}_name"), Cell(row, $"parent{n}_email"),
                                               Cell(row, $"parent{n}_language"), Cell(row, $"parent{n}_whatsapp")))
                .Where(p => p.Name.Length > 0 || p.Email.Length > 0 || p.WhatsAppPhone!.Length > 0)
                .Select(Tidy)
                .ToList()))
            .ToList();

        var rows = await CheckRowsAsync(ctx.Workspace!.Id, mode, parsed.Select(p => (p.RowNumber, p.StudentEmail, (IReadOnlyList<ParentDetails>)p.Parents)).ToList(), ct);
        return Preview(mode, rows, null);
    }

    /// <summary>
    /// "Import parents" for existing students: saves the rows the tutor kept after the preview.
    /// Re-checked here (the data may have changed since). Re-importing the same file creates no
    /// duplicates: a parent email this learner already has is updated, not added again.
    /// </summary>
    public async Task<ProvisioningResult<ParentImportResult>> CommitImportAsync(
        string slug, Guid caller, ParentImportCommitRequest request, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, requireManage: true, ct);
        if (ctx.Error is not null) return Fail<ParentImportResult>(ctx.Error.Value);
        if (request.Rows is null || request.Rows.Count == 0) return Fail<ParentImportResult>((ProvisioningError.Invalid, "Nothing to import."));
        if (request.Rows.Count > SpreadsheetReader.MaxRows) return Fail<ParentImportResult>((ProvisioningError.Invalid, "Too many rows."));

        var input = request.Rows.Select((r, i) => (RowNumber: i + 2, StudentEmail: ParentContact.NormalizeEmail(r.StudentEmail),
            Parents: (IReadOnlyList<ParentDetails>)(r.Parents ?? []))).ToList();
        var checkedRows = await CheckRowsAsync(ctx.Workspace!.Id, "existing", input, ct);

        int created = 0, updated = 0;
        var toConfirm = new List<ParentContact>();
        foreach (var row in checkedRows.Where(r => r.Ok))
        {
            var existing = await ActiveContactsAsync(row.LearnerMembershipId!.Value, ct, tracked: true);
            foreach (var p in row.Parents)
            {
                var email = ParentContact.NormalizeEmail(p.Email);
                var match = existing.FirstOrDefault(c => c.Email == email);
                if (match is not null)
                {
                    match.Update(p.Name, p.Email, NormalizeLanguage(p.Language), p.WhatsAppPhone, Now);
                    updated++;
                    continue;
                }
                var contact = ParentContact.Create(ctx.Workspace.Id, row.LearnerMembershipId.Value, p.Name, p.Email,
                    NormalizeLanguage(p.Language), p.WhatsAppPhone, ParentContactSource.Import, Now);
                db.ParentContacts.Add(contact);
                existing.Add(contact);
                toConfirm.Add(contact);
                created++;
            }
        }
        await db.SaveChangesAsync(ct);
        foreach (var contact in toConfirm) await reports.SendConfirmationAsync(contact, ct);

        var skipped = checkedRows.Where(r => !r.Ok).ToList();
        return ProvisioningResult<ParentImportResult>.Success(new ParentImportResult(created, updated, skipped.Count, skipped));
    }

    private async Task<List<ParentImportRow>> CheckRowsAsync(
        Guid workspaceId, string mode, List<(int RowNumber, string StudentEmail, IReadOnlyList<ParentDetails> Parents)> input, CancellationToken ct)
    {
        Dictionary<string, (Guid MembershipId, string Name)> learners = [];
        Dictionary<Guid, List<string>> existingEmails = [];
        if (mode == "existing")
        {
            var emails = input.Select(r => r.StudentEmail).Where(e => e.Length > 0).Distinct().ToList();
            learners = (await (
                    from m in db.Memberships.AsNoTracking()
                    join i in db.Identities.AsNoTracking() on m.IdentityId equals i.Id
                    where m.WorkspaceId == workspaceId && m.Status == MembershipStatus.Active
                       && emails.Contains(i.Email) && m.Roles.Any(r => r.Name == WorkspaceRoleName.Learner)
                    select new { i.Email, MembershipId = m.Id, i.FullName }).ToListAsync(ct))
                .GroupBy(x => x.Email).ToDictionary(g => g.Key, g => (g.First().MembershipId, g.First().FullName));
            var ids = learners.Values.Select(l => l.MembershipId).ToList();
            existingEmails = (await db.ParentContacts.AsNoTracking()
                    .Where(c => ids.Contains(c.LearnerMembershipId) && c.Status != ParentContactStatus.Removed)
                    .Select(c => new { c.LearnerMembershipId, c.Email }).ToListAsync(ct))
                .GroupBy(c => c.LearnerMembershipId).ToDictionary(g => g.Key, g => g.Select(c => c.Email).ToList());
        }

        var seenStudents = new HashSet<string>();
        var rows = new List<ParentImportRow>();
        foreach (var (rowNumber, studentEmail, parents) in input)
        {
            var problems = new List<string>();
            Guid? learnerId = null;
            string? learnerName = null;

            if (studentEmail.Length == 0) problems.Add("studentEmailMissing");
            else if (!ParentContact.IsValidEmail(studentEmail)) problems.Add("studentEmailInvalid");
            else if (!seenStudents.Add(studentEmail)) problems.Add("duplicateStudent");

            foreach (var p in parents) problems.AddRange(ProblemsOf(p));
            var parentEmails = parents.Select(p => ParentContact.NormalizeEmail(p.Email)).Where(e => e.Length > 0).ToList();
            if (parentEmails.Distinct().Count() != parentEmails.Count) problems.Add("duplicateParent");

            if (mode == "existing" && studentEmail.Length > 0 && !problems.Contains("studentEmailInvalid"))
            {
                if (learners.TryGetValue(studentEmail, out var learner))
                {
                    learnerId = learner.MembershipId;
                    learnerName = learner.Name;
                    // Already there = updated, not added — re-importing a file never counts twice.
                    var current = existingEmails.GetValueOrDefault(learner.MembershipId) ?? [];
                    if (current.Union(parentEmails).Count() > ParentContact.MaxPerLearner) problems.Add("tooManyParents");
                }
                else problems.Add("studentNotFound");
            }
            if (mode == "invite" && parents.Count > ParentContact.MaxPerLearner) problems.Add("tooManyParents");

            rows.Add(new ParentImportRow(rowNumber, studentEmail, learnerName, learnerId, parents, problems.Distinct().ToList()));
        }
        return rows;
    }

    /// <summary>
    /// What will actually be saved, so the preview shows it: email lower-cased, "Arabic" → "ar",
    /// "+20 100 123 4567" → "+201001234567". A value that can't be tidied is kept as typed, for
    /// its problem to be reported.
    /// </summary>
    private static ParentDetails Tidy(ParentDetails p)
    {
        string? phone = string.IsNullOrWhiteSpace(p.WhatsAppPhone) ? null : p.WhatsAppPhone.Trim();
        if (phone is not null)
            try { phone = ParentContact.NormalizePhone(phone); } catch (ArgumentException) { }
        var language = string.IsNullOrWhiteSpace(p.Language) ? null : NormalizeLanguage(p.Language) ?? p.Language.Trim();
        return new ParentDetails(p.Name.Trim(), ParentContact.NormalizeEmail(p.Email), language, phone);
    }

    private static IEnumerable<string> ProblemsOf(ParentDetails p)
    {
        if (string.IsNullOrWhiteSpace(p.Name)) yield return "parentNameMissing";
        if (!ParentContact.IsValidEmail(p.Email)) yield return "parentEmailInvalid";
        if (!string.IsNullOrWhiteSpace(p.Language) && NormalizeLanguage(p.Language) is null) yield return "parentLanguageInvalid";
        if (!string.IsNullOrWhiteSpace(p.WhatsAppPhone))
        {
            string? problem = null;
            try { ParentContact.NormalizePhone(p.WhatsAppPhone); } catch (ArgumentException) { problem = "parentPhoneInvalid"; }
            if (problem is not null) yield return problem;
        }
    }

    /// <summary>"ar"/"en", plus the words a tutor is likely to type in a spreadsheet. Null when unrecognised (blank → Arabic, decided by the caller).</summary>
    public static string? NormalizeLanguage(string? language)
    {
        if (string.IsNullOrWhiteSpace(language)) return SupportedLanguage.Arabic;
        return language.Trim().ToLowerInvariant() switch
        {
            "ar" or "arabic" or "عربي" or "عربى" or "العربية" => SupportedLanguage.Arabic,
            "en" or "english" or "انجليزي" or "إنجليزي" or "الإنجليزية" or "الانجليزية" => SupportedLanguage.English,
            _ => null,
        };
    }

    private static ProvisioningResult<ParentImportPreviewResponse> Preview(string mode, List<ParentImportRow> rows, string? fileProblem) =>
        ProvisioningResult<ParentImportPreviewResponse>.Success(new ParentImportPreviewResponse(mode, rows, fileProblem));

    // ── Public links (no login) ──────────────────────────────────────────────

    public Task<ParentLinkResult> ConfirmAsync(string token, CancellationToken ct = default) =>
        RedeemAsync(token, ParentLinkPurpose.Confirm, ct);

    public Task<ParentLinkResult> UnsubscribeAsync(string token, CancellationToken ct = default) =>
        RedeemAsync(token, ParentLinkPurpose.Unsubscribe, ct);

    private async Task<ParentLinkResult> RedeemAsync(string token, ParentLinkPurpose purpose, CancellationToken ct)
    {
        var claims = links.Verify(token, purpose);
        if (claims is null) return new ParentLinkResult("Invalid", null, null, null);

        var contact = await db.ParentContacts.FirstOrDefaultAsync(c => c.Id == claims.Value.ContactId, ct);
        if (contact is null || contact.Status == ParentContactStatus.Removed) return new ParentLinkResult("Invalid", null, null, null);

        var workspaceName = await db.Workspaces.AsNoTracking().Where(w => w.Id == contact.WorkspaceId).Select(w => w.Name).FirstOrDefaultAsync(ct);
        var learnerName = await (from m in db.Memberships.AsNoTracking()
                                 join i in db.Identities.AsNoTracking() on m.IdentityId equals i.Id
                                 where m.Id == contact.LearnerMembershipId
                                 select i.FullName).FirstOrDefaultAsync(ct);
        ParentLinkResult Result(string status) =>
            new(status, workspaceName, learnerName is null ? null : ParentReportService.FirstName(learnerName), contact.Language);

        if (purpose == ParentLinkPurpose.Unsubscribe)
        {
            contact.Unsubscribe(Now);
            await db.SaveChangesAsync(ct);
            return Result("Unsubscribed");
        }

        try { contact.Confirm(claims.Value.LinkVersion, Now); }
        catch (InvalidOperationException)
        {
            return Result(contact.ConfirmationLapsed(Now) ? "Expired" : "Invalid");
        }
        await db.SaveChangesAsync(ct);
        return Result("Confirmed");
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private async Task<ProvisioningResult<ParentContactRow>> AddAsync(
        Guid workspaceId, Guid learnerMembershipId, ParentDetails details, ParentContactSource source, CancellationToken ct)
    {
        var existing = await ActiveContactsAsync(learnerMembershipId, ct);
        if (existing.Count >= ParentContact.MaxPerLearner)
            return Fail<ParentContactRow>((ProvisioningError.Conflict, $"A learner can have at most {ParentContact.MaxPerLearner} parent contacts."));
        if (existing.Any(c => c.Email == ParentContact.NormalizeEmail(details.Email)))
            return Fail<ParentContactRow>((ProvisioningError.Conflict, "This learner already has a parent with that email."));

        var language = NormalizeLanguage(details.Language);
        if (language is null) return Fail<ParentContactRow>((ProvisioningError.Invalid, "Language must be Arabic or English."));

        ParentContact contact;
        try { contact = ParentContact.Create(workspaceId, learnerMembershipId, details.Name, details.Email, language, details.WhatsAppPhone, source, Now); }
        catch (ArgumentException ex) { return Fail<ParentContactRow>((ProvisioningError.Invalid, ex.Message)); }

        db.ParentContacts.Add(contact);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // The unique (learner, email) index caught a concurrent duplicate.
            return Fail<ParentContactRow>((ProvisioningError.Conflict, "This learner already has a parent with that email."));
        }

        await reports.SendConfirmationAsync(contact, ct);
        return ProvisioningResult<ParentContactRow>.Success(Describe(contact));
    }

    private Task<List<ParentContact>> ActiveContactsAsync(Guid learnerMembershipId, CancellationToken ct, bool tracked = false)
    {
        var query = db.ParentContacts.Where(c => c.LearnerMembershipId == learnerMembershipId && c.Status != ParentContactStatus.Removed);
        return (tracked ? query : query.AsNoTracking()).ToListAsync(ct);
    }

    private Task<bool> HasActiveContactWithEmailAsync(Guid learnerMembershipId, string email, CancellationToken ct) =>
        db.ParentContacts.AnyAsync(c => c.LearnerMembershipId == learnerMembershipId && c.Email == email && c.Status != ParentContactStatus.Removed, ct);

    private Task<ParentContact?> FindAsync(Guid workspaceId, Guid contactId, CancellationToken ct) =>
        db.ParentContacts.FirstOrDefaultAsync(c => c.Id == contactId && c.WorkspaceId == workspaceId && c.Status != ParentContactStatus.Removed, ct);

    private Task<bool> IsActiveLearnerAsync(Guid workspaceId, Guid membershipId, CancellationToken ct) =>
        db.Memberships.AnyAsync(m => m.Id == membershipId && m.WorkspaceId == workspaceId && m.Status == MembershipStatus.Active
                                  && m.Roles.Any(r => r.Name == WorkspaceRoleName.Learner), ct);

    private ParentContactRow Describe(ParentContact c) => new(
        c.Id, c.LearnerMembershipId, c.Name, c.Email, c.Language, c.WhatsAppPhone,
        c.Status switch
        {
            ParentContactStatus.PendingConfirmation => c.ConfirmationLapsed(Now) ? "Expired" : "Waiting",
            var s => s.ToString(),
        },
        c.Source.ToString(), c.CreatedAt, c.ConfirmationExpiresAt, c.ConfirmedAt, c.UnsubscribedAt);

    private sealed record Context(Workspace? Workspace, Guid MembershipId, bool CanManage, bool IsTutor, bool IsLearner,
        (ProvisioningError Error, string Message)? Error);

    /// <summary>A non-member gets 404, never 403 — as for members, so nobody can probe which workspaces exist.</summary>
    private async Task<Context> ResolveAsync(string slug, Guid caller, bool requireManage, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();
        var workspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new Context(null, Guid.Empty, false, false, false, (ProvisioningError.NotFound, "No such workspace."));

        var membership = await db.Memberships.Include(m => m.Roles).AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller && m.Status == MembershipStatus.Active, ct);
        if (membership is null) return new Context(null, Guid.Empty, false, false, false, (ProvisioningError.NotFound, "No such workspace."));

        var roles = membership.Roles.Select(r => r.Name).ToList();
        var canManage = roles.Any(ManagerRoles.Contains);
        var isTutor = roles.Any(r => r is WorkspaceRoleName.Teacher or WorkspaceRoleName.AssistantTeacher);
        if (requireManage && !canManage)
            return new Context(null, Guid.Empty, false, false, false,
                (ProvisioningError.Forbidden, "Only an owner or administrator can manage parent contacts."));

        return new Context(workspace, membership.Id, canManage, isTutor, roles.Contains(WorkspaceRoleName.Learner), null);
    }

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e) => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
