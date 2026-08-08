using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonRevisionIdToLessonProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LessonRevisionId",
                table: "lesson_progress",
                type: "uuid",
                nullable: true);

            // Backfill: progress recorded before this column existed had no
            // pinned revision. Attribute each row to its lesson's current
            // published revision if it still has one, else its most recent
            // revision — there is exactly one reasonable candidate either way,
            // since nothing depended on this distinction before now (PR-009).
            migrationBuilder.Sql(@"
                UPDATE lesson_progress p
                SET ""LessonRevisionId"" = COALESCE(
                    (SELECT l.""CurrentRevisionId"" FROM lessons l WHERE l.""Id"" = p.""LessonId""),
                    (SELECT r.""Id"" FROM lesson_revisions r WHERE r.""LessonId"" = p.""LessonId"" ORDER BY r.""Version"" DESC LIMIT 1)
                );
            ");

            migrationBuilder.AlterColumn<Guid>(
                name: "LessonRevisionId",
                table: "lesson_progress",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LessonRevisionId",
                table: "lesson_progress");
        }
    }
}
