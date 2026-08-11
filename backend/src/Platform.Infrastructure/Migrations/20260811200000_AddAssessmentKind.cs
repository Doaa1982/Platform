using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssessmentKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_assessments_LessonRevisionId",
                table: "assessments");

            // Backfill: every Assessment that exists before this migration is
            // the in-video checkpoint quiz — Standalone didn't exist yet — so
            // a fixed default correctly classifies every existing row, not
            // just new ones.
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "assessments",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Interactive");

            migrationBuilder.CreateIndex(
                name: "IX_assessments_LessonRevisionId_Kind",
                table: "assessments",
                columns: new[] { "LessonRevisionId", "Kind" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_assessments_LessonRevisionId_Kind",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "assessments");

            migrationBuilder.CreateIndex(
                name: "IX_assessments_LessonRevisionId",
                table: "assessments",
                column: "LessonRevisionId",
                unique: true);
        }
    }
}
