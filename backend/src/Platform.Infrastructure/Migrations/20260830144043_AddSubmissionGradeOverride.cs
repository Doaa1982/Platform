using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmissionGradeOverride : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "OverriddenAt",
                table: "submissions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OverriddenByMembershipId",
                table: "submissions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OverrideNote",
                table: "submissions",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OverridePassed",
                table: "submissions",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OverrideScorePercent",
                table: "submissions",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OverriddenAt",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "OverriddenByMembershipId",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "OverrideNote",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "OverridePassed",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "OverrideScorePercent",
                table: "submissions");
        }
    }
}
