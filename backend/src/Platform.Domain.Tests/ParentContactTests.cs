using Platform.Domain;

namespace Platform.Domain.Tests;

/// <summary>
/// Parent Progress Reports BA §5: consent first (PR-INV-001), a confirmation link only for its
/// own round and within 14 days (PR-INV-002), unsubscribe until the tutor re-invites
/// (PR-INV-003), and a changed email starting consent over.
/// </summary>
public class ParentContactTests
{
    private static readonly DateTime T0 = new(2026, 11, 1, 9, 0, 0, DateTimeKind.Utc);

    private static ParentContact NewContact(string? language = null) =>
        ParentContact.Create(Guid.NewGuid(), Guid.NewGuid(), " Hala Ahmed ", " Hala@Example.COM ", language, "+20 100 123 4567", ParentContactSource.Tutor, T0);

    [Fact]
    public void Starts_waiting_in_Arabic_with_tidied_details_and_cannot_receive_reports()
    {
        var c = NewContact();
        Assert.Equal(ParentContactStatus.PendingConfirmation, c.Status);
        Assert.False(c.CanReceiveReports);
        Assert.Equal("ar", c.Language);
        Assert.Equal("hala@example.com", c.Email);
        Assert.Equal("Hala Ahmed", c.Name);
        Assert.Equal("+201001234567", c.WhatsAppPhone);
        Assert.Equal(T0.AddDays(14), c.ConfirmationExpiresAt);
    }

    [Fact]
    public void Confirms_only_for_the_current_round_and_within_fourteen_days()
    {
        var c = NewContact();
        var firstRound = c.LinkVersion;
        Assert.Throws<InvalidOperationException>(() => c.Confirm(firstRound, T0.AddDays(15)));   // lapsed
        Assert.True(c.ConfirmationLapsed(T0.AddDays(15)));

        c.Reinvite(T0.AddDays(15));
        Assert.Throws<InvalidOperationException>(() => c.Confirm(firstRound, T0.AddDays(16)));   // old link
        c.Confirm(c.LinkVersion, T0.AddDays(16));
        Assert.True(c.CanReceiveReports);
        c.Confirm(c.LinkVersion, T0.AddDays(17)); // a second click is harmless
        Assert.Equal(T0.AddDays(16), c.ConfirmedAt);
    }

    [Fact]
    public void Unsubscribing_stops_reports_until_the_tutor_reinvites_and_the_parent_confirms_again()
    {
        var c = NewContact();
        c.Confirm(c.LinkVersion, T0);
        c.Unsubscribe(T0.AddDays(1));
        Assert.False(c.CanReceiveReports);
        Assert.Throws<InvalidOperationException>(() => c.Confirm(c.LinkVersion, T0.AddDays(1))); // the old link can't resubscribe

        c.Reinvite(T0.AddDays(2));
        Assert.Equal(ParentContactStatus.PendingConfirmation, c.Status);
        c.Confirm(c.LinkVersion, T0.AddDays(2));
        Assert.True(c.CanReceiveReports);
    }

    [Fact]
    public void A_changed_email_starts_consent_over_but_other_edits_do_not()
    {
        var c = NewContact();
        c.Confirm(c.LinkVersion, T0);
        Assert.False(c.Update("Hala A.", "hala@example.com", "en", null, T0.AddDays(1)));
        Assert.True(c.CanReceiveReports);

        Assert.True(c.Update("Hala A.", "new@example.com", "en", null, T0.AddDays(2)));
        Assert.Equal(ParentContactStatus.PendingConfirmation, c.Status);
    }

    [Fact]
    public void Removed_is_terminal_and_bad_details_are_refused()
    {
        var c = NewContact();
        c.Remove(T0);
        Assert.Throws<InvalidOperationException>(() => c.Reinvite(T0));
        Assert.Throws<InvalidOperationException>(() => c.Update("X", "x@example.com", null, null, T0));

        Assert.Throws<ArgumentException>(() => NewContact(language: "fr"));
        Assert.Throws<ArgumentException>(() => ParentContact.Create(Guid.NewGuid(), Guid.NewGuid(), "A", "not-an-email", null, null, ParentContactSource.Tutor, T0));
        Assert.Throws<ArgumentException>(() => ParentContact.Create(Guid.NewGuid(), Guid.NewGuid(), "A", "a@b.co", null, "12", ParentContactSource.Tutor, T0));
    }
}
