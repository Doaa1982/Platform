using Microsoft.EntityFrameworkCore;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// A member's own in-app inbox (Notification.cs) — read-only browsing and
/// marking read. Nothing here creates a Notification; that happens at the
/// point something worth notifying about occurs (see
/// AssessmentService.NotifyQuestionsUpdatedAsync for the one kind that exists
/// so far).
/// </summary>
public class NotificationService(PlatformDbContext db)
{
    public async Task<ProvisioningResult<NotificationListResponse>> GetMineAsync(
        string slug, Guid caller, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<NotificationListResponse>(ctx.Error.Value);

        var rows = await db.Notifications.AsNoTracking()
            .Where(n => n.MembershipId == ctx.MembershipId)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NotificationRow(n.Id, n.Kind.ToString(), n.LessonId, n.Title, n.Message, n.CreatedAt, n.ReadAt))
            .ToListAsync(ct);

        return ProvisioningResult<NotificationListResponse>.Success(
            new NotificationListResponse(rows, rows.Count(n => n.ReadAt is null)));
    }

    public async Task<ProvisioningResult<bool>> MarkReadAsync(
        string slug, Guid caller, Guid notificationId, CancellationToken ct = default)
    {
        var ctx = await ResolveAsync(slug, caller, ct);
        if (ctx.Error is not null) return Fail<bool>(ctx.Error.Value);

        var notification = await db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.MembershipId == ctx.MembershipId, ct);
        if (notification is null) return Fail<bool>((ProvisioningError.NotFound, "No such notification."));

        notification.MarkRead();
        await db.SaveChangesAsync(ct);
        return ProvisioningResult<bool>.Success(true);
    }

    private record Context(Guid MembershipId, (ProvisioningError Error, string Message)? Error);

    private async Task<Context> ResolveAsync(string slug, Guid caller, CancellationToken ct)
    {
        var normalised = slug.ToLowerInvariant().Trim();

        var workspace = await db.Workspaces.AsNoTracking().FirstOrDefaultAsync(w => w.Slug == normalised, ct);
        if (workspace is null) return new Context(Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        var member = await db.Memberships.AsNoTracking()
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id && m.IdentityId == caller
                                   && m.Status == MembershipStatus.Active, ct);
        // Non-members get 404 so status codes cannot map which workspaces exist
        if (member is null) return new Context(Guid.Empty, (ProvisioningError.NotFound, "No such workspace."));

        return new Context(member.Id, null);
    }

    private static ProvisioningResult<T> Fail<T>((ProvisioningError Error, string Message) e)
        => ProvisioningResult<T>.Fail(e.Error, e.Message);
}
