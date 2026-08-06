using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEnrollmentSubmissionProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "enrollments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    LearningProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    MembershipId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_enrollments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lesson_progress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    VideoWatched = table.Column<bool>(type: "boolean", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lesson_progress", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "submissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssessmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MembershipId = table.Column<Guid>(type: "uuid", nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ScorePercent = table.Column<int>(type: "integer", nullable: false),
                    Passed = table.Column<bool>(type: "boolean", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GradedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_submissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "submission_answers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SelectedOptionIndex = table.Column<int>(type: "integer", nullable: true),
                    TextAnswer = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_submission_answers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_submission_answers_submissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalTable: "submissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_enrollments_LearningProductId_MembershipId",
                table: "enrollments",
                columns: new[] { "LearningProductId", "MembershipId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lesson_progress_EnrollmentId_LessonId",
                table: "lesson_progress",
                columns: new[] { "EnrollmentId", "LessonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_submission_answers_SubmissionId",
                table: "submission_answers",
                column: "SubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_submissions_AssessmentId_MembershipId",
                table: "submissions",
                columns: new[] { "AssessmentId", "MembershipId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "enrollments");

            migrationBuilder.DropTable(
                name: "lesson_progress");

            migrationBuilder.DropTable(
                name: "submission_answers");

            migrationBuilder.DropTable(
                name: "submissions");
        }
    }
}
