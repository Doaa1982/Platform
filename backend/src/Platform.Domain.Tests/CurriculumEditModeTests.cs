using Platform.Domain;
using Xunit;

namespace Platform.Domain.Tests;

/// <summary>Edit Mode keeps learners on the structure as last published (Curriculum.PublishedUnits).</summary>
public class CurriculumEditModeTests
{
    private static Curriculum Published(out Guid lessonId)
    {
        var c = Curriculum.Create(Guid.NewGuid(), Guid.NewGuid(), "Algebra");
        var unit = c.AddUnit("Unit one");
        lessonId = Guid.NewGuid();
        c.AddLessonToUnit(unit.Id, lessonId);
        c.Publish();
        return c;
    }

    [Fact]
    public void Edit_Mode_Keeps_It_Published_And_Learners_On_The_Published_Structure()
    {
        var c = Published(out var lessonId);
        c.OpenDraft();

        Assert.Equal(CurriculumStatus.Published, c.Status);
        Assert.True(c.DraftOpen);

        var unit2 = c.AddUnit("Unit two");                    // allowed in Edit Mode
        c.AddLessonToUnit(unit2.Id, Guid.NewGuid());
        c.RenameUnit(c.Units.First(u => u.Title == "Unit one").Id, "Renamed");

        var seen = c.PublishedUnits();
        Assert.Single(seen);
        Assert.Equal("Unit one", seen[0].Title);
        Assert.Equal([lessonId], seen[0].Lessons.Select(l => l.LessonId));

        c.Publish();
        Assert.False(c.DraftOpen);
        Assert.Equal(["Renamed", "Unit two"], c.PublishedUnits().Select(u => u.Title));
    }

    [Fact]
    public void A_Published_Curriculum_Cannot_Be_Restructured_Outside_Edit_Mode_Or_Republished_Without_Changes()
    {
        var c = Published(out _);
        Assert.Throws<InvalidOperationException>(() => c.AddUnit("Sneaky"));
        Assert.Throws<InvalidOperationException>(() => c.Publish());
    }

    [Fact]
    public void Unpublish_Still_Withdraws_It_Entirely()
    {
        var c = Published(out _);
        c.OpenDraft();
        c.Unpublish();
        Assert.Equal(CurriculumStatus.Draft, c.Status);
        Assert.False(c.DraftOpen);
        Assert.Empty(c.PublishedUnits());
    }
}
