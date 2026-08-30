using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssignmentAndLearningActivity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "AssessmentId",
                table: "submissions",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "AssignmentId",
                table: "submissions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AssignmentPassed",
                table: "submissions",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AttemptNumber",
                table: "submissions",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTime>(
                name: "EvaluatedAt",
                table: "submissions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EvaluationMethod",
                table: "submissions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EvaluatorMembershipId",
                table: "submissions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ExcludedFromAttemptCount",
                table: "submissions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Feedback",
                table: "submissions",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ResponseLearningAssetId",
                table: "submissions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponseText",
                table: "submissions",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AssignmentId",
                table: "notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    LearningActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    LearningProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorMembershipId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AvailabilityMode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ScheduledAvailabilityAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DueDateMode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SubmissionWindowStartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SubmissionWindowEndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AttemptMode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MaxAttempts = table.Column<int>(type: "integer", nullable: true),
                    EvaluationMethod = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Visible = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyOnPublish = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyOnFeedbackPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ArchivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assignments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "learning_activities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonRevisionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Instructions = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    AssessmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExternalUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learning_activities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_learning_activities_lesson_revisions_LessonRevisionId",
                        column: x => x.LessonRevisionId,
                        principalTable: "lesson_revisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_submissions_AssignmentId_MembershipId",
                table: "submissions",
                columns: new[] { "AssignmentId", "MembershipId" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_submissions_exactly_one_target",
                table: "submissions",
                sql: "((\"AssessmentId\" IS NOT NULL)::int + (\"AssignmentId\" IS NOT NULL)::int) = 1");

            migrationBuilder.CreateIndex(
                name: "IX_assignments_LearningActivityId",
                table: "assignments",
                column: "LearningActivityId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_assignments_LearningProductId",
                table: "assignments",
                column: "LearningProductId");

            migrationBuilder.CreateIndex(
                name: "IX_learning_activities_LessonRevisionId",
                table: "learning_activities",
                column: "LessonRevisionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "assignments");

            migrationBuilder.DropTable(
                name: "learning_activities");

            migrationBuilder.DropIndex(
                name: "IX_submissions_AssignmentId_MembershipId",
                table: "submissions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_submissions_exactly_one_target",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "AssignmentId",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "AssignmentPassed",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "AttemptNumber",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "EvaluatedAt",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "EvaluationMethod",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "EvaluatorMembershipId",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "ExcludedFromAttemptCount",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "Feedback",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "ResponseLearningAssetId",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "ResponseText",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "AssignmentId",
                table: "notifications");

            migrationBuilder.AlterColumn<Guid>(
                name: "AssessmentId",
                table: "submissions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
