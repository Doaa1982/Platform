namespace Platform.Api.AI;

/// <summary>
/// Thrown by <see cref="AiOrchestrator"/> when a workspace's AI credit
/// balance can't cover a skill's cost — distinct from the bare
/// <see cref="InvalidOperationException"/> a malformed model response
/// throws, so callers (and eventually the API layer, Phase 5 of Documents/
/// AICreditsCommercialContractAndImplementationPlan.md) can tell "out of
/// credits" from "model failed" and show the right thing (a buy-credits/
/// upgrade prompt vs. a generic error).
/// </summary>
public class CreditsExhaustedException(string skillKey, int cost, int remainingBalance)
    : Exception($"This workspace has {remainingBalance} AI credit(s) remaining, but \"{skillKey}\" costs {cost}.")
{
    public string SkillKey { get; } = skillKey;
    public int Cost { get; } = cost;
    public int RemainingBalance { get; } = remainingBalance;
}
