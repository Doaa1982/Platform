namespace Platform.Domain;

/// <summary>
/// Append-only audit record for a Subscription's state changes — Commercial
/// Domain Data Model.md §4/§6: "SUBSCRIPTION_EVENT doubles as the Manual
/// Commercial Activation record." Since this platform doesn't process
/// payment, this is what answers "why does this subscription have this
/// state" in place of a payment transaction record (§27a).
///
/// <see cref="TriggeredByIdentityId"/> is null for a system/date-driven
/// transition (an overdue sweep marking a Subscription PastDue) and set to
/// the acting Platform Operator's Identity for a manual one (marking an
/// Invoice paid, escalating to Suspended). Authority for who may act is
/// PlatformOperator, the same grant AdminController already checks — a
/// Subscription's own commercial state is a back-office concern, not
/// something the Membership that owns the Workspace decides for itself.
/// </summary>
public class SubscriptionEvent
{
    public Guid Id { get; private set; }
    public Guid SubscriptionId { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public DateTime OccurredAt { get; private set; }
    public Guid? TriggeredByIdentityId { get; private set; }
    public string? ReferenceNote { get; private set; }

    // Required by EF Core — not for application use
    private SubscriptionEvent() { }

    public static SubscriptionEvent Record(
        Guid subscriptionId, string eventType, Guid? triggeredByIdentityId, string? referenceNote)
    {
        if (subscriptionId == Guid.Empty)
            throw new ArgumentException("A Subscription Event belongs to exactly one Subscription.", nameof(subscriptionId));
        ArgumentException.ThrowIfNullOrWhiteSpace(eventType);

        return new SubscriptionEvent
        {
            Id = Guid.NewGuid(),
            SubscriptionId = subscriptionId,
            EventType = eventType,
            OccurredAt = DateTime.UtcNow,
            TriggeredByIdentityId = triggeredByIdentityId,
            ReferenceNote = string.IsNullOrWhiteSpace(referenceNote) ? null : referenceNote.Trim(),
        };
    }
}
