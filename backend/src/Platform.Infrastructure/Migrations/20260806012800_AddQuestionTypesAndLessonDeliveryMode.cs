using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionTypesAndLessonDeliveryMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeliveryMode",
                table: "lesson_revisions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Recorded");

            migrationBuilder.AlterColumn<int>(
                name: "CorrectOptionIndex",
                table: "assessment_questions",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string[]>(
                name: "AcceptedAnswers",
                table: "assessment_questions",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeliveryMode",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "AcceptedAnswers",
                table: "assessment_questions");

            migrationBuilder.AlterColumn<int>(
                name: "CorrectOptionIndex",
                table: "assessment_questions",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
