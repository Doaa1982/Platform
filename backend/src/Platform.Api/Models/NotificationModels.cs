namespace Platform.Api.Models;

/// <summary>Kind is one of "LessonQuestionsUpdated" (NotificationKind) — more get added as more real events start triggering them.</summary>
public record NotificationRow(Guid Id, string Kind, Guid LessonId, string Title, string Message, DateTime CreatedAt, DateTime? ReadAt);

public record NotificationListResponse(IReadOnlyList<NotificationRow> Notifications, int UnreadCount);
