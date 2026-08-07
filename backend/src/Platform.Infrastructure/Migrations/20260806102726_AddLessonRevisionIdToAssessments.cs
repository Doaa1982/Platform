using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonRevisionIdToAssessments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_assessments_LessonId",
                table: "assessments");

            migrationBuilder.AddColumn<Guid>(
                name: "LessonRevisionId",
                table: "assessments",
                type: "uuid",
                nullable: true);

            // Backfill: an Assessment created before this migration was scoped to
            // a whole Lesson. Attribute each one to that lesson's current
            // published revision if it has one, else its sole open draft
            // revision — there is exactly one candidate either way, since no
            // lesson had a second revision before this Assessment/LessonRevision
            // relationship existed.
            migrationBuilder.Sql(@"
                UPDATE assessments a
                SET ""LessonRevisionId"" = COALESCE(
                    (SELECT l.""CurrentRevisionId"" FROM lessons l WHERE l.""Id"" = a.""LessonId""),
                    (SELECT r.""Id"" FROM lesson_revisions r WHERE r.""LessonId"" = a.""LessonId"" ORDER BY r.""Version"" DESC LIMIT 1)
                );
            ");

            migrationBuilder.AlterColumn<Guid>(
                name: "LessonRevisionId",
                table: "assessments",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_assessments_LessonRevisionId",
                table: "assessments",
                column: "LessonRevisionId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_assessments_LessonRevisionId",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "LessonRevisionId",
                table: "assessments");

            migrationBuilder.CreateIndex(
                name: "IX_assessments_LessonId",
                table: "assessments",
                column: "LessonId",
                unique: true);
        }
    }
}
