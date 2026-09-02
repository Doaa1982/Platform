using Platform.Domain;
using Xunit;

namespace Platform.Domain.Tests;

/// <summary>
/// The dedup decision itself (CreditLedgerService.TryDebitAsync's windowed
/// lookup by fingerprint) needs a real database and has no integration test
/// project to live in yet — this covers the part reachable from here: that a
/// Debit entry actually carries the fingerprint it was given, since
/// CreditLedgerService's dedup query depends entirely on that being persisted
/// correctly.
/// </summary>
public class CreditLedgerEntryIdempotencyTests
{
    [Fact]
    public void Debit_WithFingerprint_StoresIt()
    {
        var entry = CreditLedgerEntry.Debit(Guid.NewGuid(), "skill.generate-quiz", 5, idempotencyFingerprint: "abc123");

        Assert.Equal("abc123", entry.IdempotencyFingerprint);
    }

    [Fact]
    public void Debit_WithoutFingerprint_IsNull()
    {
        var entry = CreditLedgerEntry.Debit(Guid.NewGuid(), "skill.generate-quiz", 5);

        Assert.Null(entry.IdempotencyFingerprint);
    }
}
