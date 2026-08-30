using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdaptiveAssessment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdaptiveConfiguration",
                table: "assessments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DifficultyTier",
                table: "assessment_questions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdaptiveConfiguration",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "DifficultyTier",
                table: "assessment_questions");
        }
    }
}
