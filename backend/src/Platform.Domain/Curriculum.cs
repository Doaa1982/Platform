using System.Text.Json;

namespace Platform.Domain;

/// <summary>A lesson's place in the structure learners see — part of <see cref="Curriculum.PublishedUnits"/>.</summary>
public sealed record PublishedCurriculumLesson(Guid LessonId, int Position);

/// <summary>A unit as learners see it: the structure as it stood when the curriculum was last published.</summary>
public sealed record PublishedCurriculumUnit(Guid Id, string Title, int Position, IReadOnlyList<PublishedCurriculumLesson> Lessons);

/// <summary>
/// One lesson's placement inside a Curriculum Unit.
///
/// A reference, not the Lesson itself: the same Lesson could in principle be
/// placed in more than one Curriculum, and its content lifecycle is its own
/// (Learning Product Aggregate Design §10 — the Product is what is offered, the
/// Curriculum is what is taught, the Lesson is a thing that teaches).
/// </summary>
public class CurriculumLesson
{
    public Guid Id { get; private set; }
    public Guid UnitId { get; private set; }
    public Guid LessonId { get; private set; }
    public int Position { get; private set; }

    private CurriculumLesson() { }

    internal static CurriculumLesson Place(Guid unitId, Guid lessonId, int position) => new()
    {
        Id = Guid.NewGuid(), UnitId = unitId, LessonId = lessonId, Position = position
    };

    internal void MoveTo(int position) => Position = position;
}

/// <summary>A named, ordered grouping of lessons — a module, week or chapter.</summary>
public class CurriculumUnit
{
    private readonly List<CurriculumLesson> _lessons = [];

    public Guid Id { get; private set; }
    public Guid CurriculumId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public int Position { get; private set; }

    public IReadOnlyCollection<CurriculumLesson> Lessons => _lessons.AsReadOnly();

    private CurriculumUnit() { }

    internal static CurriculumUnit Create(Guid curriculumId, string title, int position)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        return new CurriculumUnit
        {
            Id = Guid.NewGuid(), CurriculumId = curriculumId, Title = title.Trim(), Position = position
        };
    }

    internal void Rename(string title)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        Title = title.Trim();
    }

    internal void MoveTo(int position) => Position = position;

    internal CurriculumLesson AddLesson(Guid lessonId)
    {
        if (_lessons.Any(l => l.LessonId == lessonId))
            throw new InvalidOperationException("That lesson is already in this unit.");

        var placed = CurriculumLesson.Place(Id, lessonId, _lessons.Count);
        _lessons.Add(placed);
        return placed;
    }

    internal void RemoveLesson(Guid lessonId)
    {
        _lessons.RemoveAll(l => l.LessonId == lessonId);
        Renumber();
    }

    /// <summary>
    /// Applies a caller-supplied order. Validation that it is exactly a
    /// permutation of this unit's current lessons is the aggregate root's job
    /// (Curriculum.ReorderLessonsInUnit) — by the time this runs it is trusted.
    /// </summary>
    internal void ReorderLessons(IReadOnlyList<Guid> orderedLessonIds)
    {
        for (var i = 0; i < orderedLessonIds.Count; i++)
            _lessons.First(l => l.LessonId == orderedLessonIds[i]).MoveTo(i);
    }

    /// <summary>Keeps positions contiguous so ordering never develops gaps.</summary>
    private void Renumber()
    {
        var ordered = _lessons.OrderBy(l => l.Position).ToList();
        for (var i = 0; i < ordered.Count; i++) ordered[i].MoveTo(i);
    }
}

/// <summary>
/// Curriculum Aggregate Root.
///
/// The pedagogical shape of one Learning Product — what is taught, in what
/// order (Learning Product Aggregate Design §10). The Product is the offer;
/// this is the substance behind it.
///
/// Invariants enforced here:
///   INV-008: a published Curriculum contains at least one Unit.
///   INV-009: every Unit contains at least one Lesson before publication.
///
/// Those two are what Learning Product INV-006 has been waiting on: until a
/// Curriculum could exist and be published, a "Published" Learning Product was
/// an announced offer with nothing inside it.
/// </summary>
public class Curriculum
{
    private readonly List<CurriculumUnit> _units = [];

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid LearningProductId { get; private set; }

    /// <summary>Distinguishes editions of the same product, e.g. "2026 edition".</summary>
    public string Title { get; private set; } = string.Empty;

    public CurriculumStatus Status { get; private set; }

    /// <summary>
    /// Edit Mode on a published curriculum: the units below are a private working copy the tutor
    /// may restructure, while learners keep the structure in <see cref="PublishedStructure"/>
    /// until <see cref="Publish"/> runs again. (Edit Mode used to unpublish the curriculum
    /// outright, locking every enrolled learner out of the course while the tutor edited.)
    /// </summary>
    public bool DraftOpen { get; private set; }

    /// <summary>
    /// The units and lesson placements as of the last <see cref="Publish"/>, serialized — what
    /// learners are served (<see cref="PublishedUnits"/>). Null for a curriculum published
    /// before snapshots existed: its live units are by definition what was published, since
    /// they could not change while it was published.
    /// </summary>
    public string? PublishedStructure { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }

    /// <summary>
    /// Off by default. When on, a Learner cannot open a lesson until the one
    /// immediately before it (in curriculum order) is Completed — enforced by
    /// LearningDeliveryService, not this aggregate, since it depends on
    /// per-enrollment LessonProgress this aggregate has no knowledge of.
    /// </summary>
    public bool RequiresSequentialCompletion { get; private set; }

    public IReadOnlyCollection<CurriculumUnit> Units => _units.AsReadOnly();

    private Curriculum() { }

    public static Curriculum Create(Guid workspaceId, Guid learningProductId, string title)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Curriculum belongs to one Workspace.", nameof(workspaceId));
        if (learningProductId == Guid.Empty)
            throw new ArgumentException("A Curriculum belongs to one Learning Product.", nameof(learningProductId));
        ArgumentException.ThrowIfNullOrWhiteSpace(title);

        var now = DateTime.UtcNow;
        return new Curriculum
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            LearningProductId = learningProductId,
            Title = title.Trim(),
            Status = CurriculumStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    // ── Structure ────────────────────────────────────────────────────────────

    public CurriculumUnit AddUnit(string title)
    {
        RequireEditable();
        var unit = CurriculumUnit.Create(Id, title, _units.Count);
        _units.Add(unit);
        Touch();
        return unit;
    }

    public void RenameUnit(Guid unitId, string title)
    {
        RequireEditable();
        Unit(unitId).Rename(title);
        Touch();
    }

    public void RemoveUnit(Guid unitId)
    {
        RequireEditable();
        _units.RemoveAll(u => u.Id == unitId);
        var ordered = _units.OrderBy(u => u.Position).ToList();
        for (var i = 0; i < ordered.Count; i++) ordered[i].MoveTo(i);
        Touch();
    }

    public void AddLessonToUnit(Guid unitId, Guid lessonId)
    {
        RequireEditable();
        Unit(unitId).AddLesson(lessonId);
        Touch();
    }

    public void RemoveLessonFromUnit(Guid unitId, Guid lessonId)
    {
        RequireEditable();
        Unit(unitId).RemoveLesson(lessonId);
        Touch();
    }

    /// <summary>Every lesson referenced anywhere in this curriculum.</summary>
    public IEnumerable<Guid> AllLessonIds =>
        _units.SelectMany(u => u.Lessons).Select(l => l.LessonId);

    /// <summary>
    /// Re-sequences this curriculum's units. <paramref name="orderedUnitIds"/>
    /// must be exactly this curriculum's current units, once each — same
    /// editable-while-Draft rule as every other structural change, since a
    /// learner mid-course should not have the order shift beneath them.
    /// </summary>
    public void ReorderUnits(IReadOnlyList<Guid> orderedUnitIds)
    {
        RequireEditable();
        RequirePermutation(_units.Select(u => u.Id), orderedUnitIds, "unit");
        for (var i = 0; i < orderedUnitIds.Count; i++) Unit(orderedUnitIds[i]).MoveTo(i);
        Touch();
    }

    /// <summary>Re-sequences one unit's lessons. Same permutation rule as <see cref="ReorderUnits"/>.</summary>
    public void ReorderLessonsInUnit(Guid unitId, IReadOnlyList<Guid> orderedLessonIds)
    {
        RequireEditable();
        var unit = Unit(unitId);
        RequirePermutation(unit.Lessons.Select(l => l.LessonId), orderedLessonIds, "lesson");
        unit.ReorderLessons(orderedLessonIds);
        Touch();
    }

    /// <summary>
    /// Toggles sequential unlock. Deliberately not gated by RequireEditable —
    /// it's a policy switch, not a structural change, so it stays changeable
    /// even while Published (an archived curriculum is the only exception:
    /// there is nothing left for it to gate).
    /// </summary>
    public void SetSequentialUnlock(bool enabled)
    {
        if (Status == CurriculumStatus.Archived)
            throw new InvalidOperationException("An archived curriculum cannot be edited.");
        RequiresSequentialCompletion = enabled;
        Touch();
    }

    private static void RequirePermutation(IEnumerable<Guid> current, IReadOnlyList<Guid> proposed, string what)
    {
        var currentOrdered = current.OrderBy(x => x).ToList();
        var proposedOrdered = proposed.OrderBy(x => x).ToList();
        if (!currentOrdered.SequenceEqual(proposedOrdered))
            throw new ArgumentException(
                $"The given order must include exactly this curriculum's current {what}s, once each.", nameof(proposed));
    }

    // ── Publication ──────────────────────────────────────────────────────────

    /// <summary>
    /// Whether publication is currently permitted, and why not if it isn't.
    /// Returned rather than thrown so a client can show the reason before the
    /// tutor clicks, instead of only after.
    /// </summary>
    public string? PublicationBlocker()
    {
        if (_units.Count == 0)
            return "A curriculum needs at least one unit before it can be published (INV-008).";

        var empty = _units.Where(u => u.Lessons.Count == 0).Select(u => u.Title).ToList();
        if (empty.Count > 0)
            return $"Every unit needs at least one lesson (INV-009). Still empty: {string.Join(", ", empty)}.";

        return null;
    }

    /// <summary>
    /// Publishes the structure: first publication, or the tutor publishing their Edit Mode
    /// changes. Either way the current units become what learners see.
    /// </summary>
    public void Publish()
    {
        if (Status == CurriculumStatus.Archived)
            throw new InvalidOperationException("An archived curriculum cannot be edited.");
        if (Status == CurriculumStatus.Published && !DraftOpen)
            throw new InvalidOperationException("This curriculum is already published, with no unpublished changes.");

        var blocker = PublicationBlocker();
        if (blocker is not null) throw new InvalidOperationException(blocker);

        PublishedStructure = JsonSerializer.Serialize(SnapshotOfLiveUnits());
        Status = CurriculumStatus.Published;
        DraftOpen = false;
        PublishedAt = DateTime.UtcNow;
        Touch();
    }

    /// <summary>
    /// Edit Mode: opens a private working copy of a published curriculum's structure. The
    /// curriculum stays Published and learners keep what was last published
    /// (<see cref="PublishedUnits"/>) until <see cref="Publish"/>. Idempotent.
    /// </summary>
    public void OpenDraft()
    {
        if (Status != CurriculumStatus.Published)
            throw new InvalidOperationException("Only a published curriculum has an Edit Mode — a draft one can be edited directly.");
        if (DraftOpen) return;

        // A curriculum published before snapshots existed: its live units are what was
        // published, so freeze them now, before the first edit changes them.
        PublishedStructure ??= JsonSerializer.Serialize(SnapshotOfLiveUnits());
        DraftOpen = true;
        Touch();
    }

    /// <summary>
    /// Withdraws the curriculum from learners altogether — back to Draft. Not Edit Mode
    /// (<see cref="OpenDraft"/>), which keeps learners on the published structure.
    /// </summary>
    public void Unpublish()
    {
        if (Status != CurriculumStatus.Published)
            throw new InvalidOperationException("Only a published curriculum can be unpublished.");

        Status = CurriculumStatus.Draft;
        DraftOpen = false;
        PublishedStructure = null;
        Touch();
    }

    /// <summary>
    /// The structure learners see: the last published one. Empty unless Published. Every
    /// learner-facing read goes through this, never through <see cref="Units"/>, which while
    /// <see cref="DraftOpen"/> is the tutor's unpublished working copy.
    /// </summary>
    public IReadOnlyList<PublishedCurriculumUnit> PublishedUnits()
    {
        if (Status != CurriculumStatus.Published) return [];
        if (PublishedStructure is null) return SnapshotOfLiveUnits();
        return JsonSerializer.Deserialize<List<PublishedCurriculumUnit>>(PublishedStructure) ?? [];
    }

    private List<PublishedCurriculumUnit> SnapshotOfLiveUnits() =>
        _units.OrderBy(u => u.Position)
            .Select(u => new PublishedCurriculumUnit(u.Id, u.Title, u.Position,
                u.Lessons.OrderBy(l => l.Position).Select(l => new PublishedCurriculumLesson(l.LessonId, l.Position)).ToList()))
            .ToList();

    public void Archive()
    {
        if (Status == CurriculumStatus.Archived)
            throw new InvalidOperationException("This curriculum is already archived.");

        Status = CurriculumStatus.Archived;
        DraftOpen = false;
        Touch();
    }

    private CurriculumUnit Unit(Guid unitId) =>
        _units.FirstOrDefault(u => u.Id == unitId)
        ?? throw new InvalidOperationException("No such unit in this curriculum.");

    private void RequireEditable()
    {
        if (Status == CurriculumStatus.Archived)
            throw new InvalidOperationException("An archived curriculum cannot be edited.");
        if (Status == CurriculumStatus.Published && !DraftOpen)
            throw new InvalidOperationException(
                "A published curriculum cannot be restructured directly. Turn on Edit Mode first — learners are following it as it stands.");
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
