using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLearningActivitySubmissionSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ActivityFileAssetId",
                table: "learning_activities",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmissionMode",
                table: "learning_activities",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "TextOrFile");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActivityFileAssetId",
                table: "learning_activities");

            migrationBuilder.DropColumn(
                name: "SubmissionMode",
                table: "learning_activities");
        }
    }
}
