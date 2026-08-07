using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BackfillLessonTitleFromRevision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Before this change, editing a lesson's title (draft save,
            // quick-edit, or publish) updated the revision's own Title but
            // never the Lesson's — so lists (which always show lessons.Title)
            // drifted from whatever the tutor actually last saved. One-time
            // catch-up for rows written before the fix; every save from here
            // on keeps them in sync going forward.
            migrationBuilder.Sql(@"
                UPDATE lessons l
                SET ""Title"" = COALESCE(
                    (SELECT r.""Title"" FROM lesson_revisions r WHERE r.""LessonId"" = l.""Id"" AND r.""Status"" = 'Draft'),
                    (SELECT r.""Title"" FROM lesson_revisions r WHERE r.""Id"" = l.""CurrentRevisionId""),
                    (SELECT r.""Title"" FROM lesson_revisions r WHERE r.""LessonId"" = l.""Id"" ORDER BY r.""Version"" DESC LIMIT 1)
                )
                WHERE EXISTS (SELECT 1 FROM lesson_revisions r WHERE r.""LessonId"" = l.""Id"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only backfill; not reversible.
        }
    }
}
