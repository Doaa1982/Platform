using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCurriculumEditDraftAndActivityLineage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LineageId",
                table: "learning_activities",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Every existing activity starts its own lineage. Copies made by earlier revisions are
            // deliberately not linked to their originals: an activity assigned twice already has
            // two assignments with their own submissions, and guessing which rows are "the same
            // activity" (by title or position) could merge the wrong ones.
            migrationBuilder.Sql("UPDATE learning_activities SET \"LineageId\" = \"Id\";");

            migrationBuilder.AddColumn<bool>(
                name: "DraftOpen",
                table: "curricula",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PublishedStructure",
                table: "curricula",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_learning_activities_LineageId",
                table: "learning_activities",
                column: "LineageId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_learning_activities_LineageId",
                table: "learning_activities");

            migrationBuilder.DropColumn(
                name: "LineageId",
                table: "learning_activities");

            migrationBuilder.DropColumn(
                name: "DraftOpen",
                table: "curricula");

            migrationBuilder.DropColumn(
                name: "PublishedStructure",
                table: "curricula");
        }
    }
}
