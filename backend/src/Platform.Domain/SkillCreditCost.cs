namespace Platform.Domain;

/// <summary>
/// Skill Credit Cost — Documents/AICreditsCommercialContractAndImplementationPlan.md
/// §A2/Phase 0. The price (in AI credits) of one call to one AI skill,
/// versioned like <see cref="CommercialProductVersion"/> rather than edited
/// in place, so a past debit remains explainable against the price that was
/// actually in effect when it happened.
///
/// Most skills are flat-priced (<see cref="Band"/> is null). The three
/// banded skills (grading, standalone-quiz generation, lesson-quiz
/// generation) have multiple rows sharing a <see cref="SkillKey"/>, one per
/// band, distinguished by <see cref="Band"/> — the caller supplies which
/// band applies (PACKAGING-007: the skill itself only ever supplies a size
/// signal, never a price).
/// </summary>
public class SkillCreditCost
{
    public Guid Id { get; private set; }
    public string SkillKey { get; private set; } = string.Empty;

    /// <summary>Null for a flat-priced skill. Set for a banded skill — the upper bound of the band this row prices (e.g. 15 questions, 30 open answers).</summary>
    public int? Band { get; private set; }

    public int CreditCost { get; private set; }
    public DateTime EffectiveFrom { get; private set; }

    // Required by EF Core — not for application use
    private SkillCreditCost() { }

    public static SkillCreditCost Create(string skillKey, int? band, int creditCost, DateTime? effectiveFrom = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(skillKey);
        if (band is <= 0)
            throw new ArgumentException("A band, when given, must be a positive upper bound.", nameof(band));
        if (creditCost <= 0)
            throw new ArgumentException("A skill's credit cost must be positive.", nameof(creditCost));

        return new SkillCreditCost
        {
            Id = Guid.NewGuid(),
            SkillKey = skillKey.Trim(),
            Band = band,
            CreditCost = creditCost,
            EffectiveFrom = effectiveFrom ?? DateTime.UtcNow,
        };
    }
}
