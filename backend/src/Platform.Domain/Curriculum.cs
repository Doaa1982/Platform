namespace Platform.Domain;

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

    public void Publish()
    {
        RequireEditable();

        var blocker = PublicationBlocker();
        if (blocker is not null) throw new InvalidOperationException(blocker);

        Status = CurriculumStatus.Published;
        PublishedAt = DateTime.UtcNow;
        Touch();
    }

    /// <summary>
    /// Back to Draft. Structure becomes editable again — which is why editing is
    /// blocked while Published: a learner partway through a course should not
    /// have units appear and vanish beneath them.
    /// </summary>
    public void Unpublish()
    {
        if (Status != CurriculumStatus.Published)
            throw new InvalidOperationException("Only a published curriculum can be unpublished.");

        Status = CurriculumStatus.Draft;
        Touch();
    }

    public void Archive()
    {
        if (Status == CurriculumStatus.Archived)
            throw new InvalidOperationException("This curriculum is already archived.");

        Status = CurriculumStatus.Archived;
        Touch();
    }

    private CurriculumUnit Unit(Guid unitId) =>
        _units.FirstOrDefault(u => u.Id == unitId)
        ?? throw new InvalidOperationException("No such unit in this curriculum.");

    private void RequireEditable()
    {
        if (Status == CurriculumStatus.Archived)
            throw new InvalidOperationException("An archived curriculum cannot be edited.");
        if (Status == CurriculumStatus.Published)
            throw new InvalidOperationException(
                "A published curriculum cannot be restructured. Unpublish it first — learners are following it as it stands.");
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
