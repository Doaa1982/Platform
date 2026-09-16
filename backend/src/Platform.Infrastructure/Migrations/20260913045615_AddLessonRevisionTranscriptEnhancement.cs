using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonRevisionTranscriptEnhancement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EnhancedTranscript",
                table: "lesson_revisions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EnhancementCompletedAt",
                table: "lesson_revisions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EnhancementError",
                table: "lesson_revisions",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EnhancementJobId",
                table: "lesson_revisions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EnhancementModel",
                table: "lesson_revisions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EnhancementPreservationChecksJson",
                table: "lesson_revisions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EnhancementPromptVersion",
                table: "lesson_revisions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EnhancementProvider",
                table: "lesson_revisions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EnhancementRequestedAt",
                table: "lesson_revisions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EnhancementReviewItemsJson",
                table: "lesson_revisions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EnhancementSegmentsJson",
                table: "lesson_revisions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EnhancementStatus",
                table: "lesson_revisions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.AddColumn<int>(
                name: "EnhancementVersion",
                table: "lesson_revisions",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EnhancedTranscript",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementCompletedAt",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementError",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementJobId",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementModel",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementPreservationChecksJson",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementPromptVersion",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementProvider",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementRequestedAt",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementReviewItemsJson",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementSegmentsJson",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementStatus",
                table: "lesson_revisions");

            migrationBuilder.DropColumn(
                name: "EnhancementVersion",
                table: "lesson_revisions");
        }
    }
}
