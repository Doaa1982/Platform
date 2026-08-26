using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCommercialPlanLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LearnerCapacity",
                table: "configuration_snapshots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "VideoStorageGb",
                table: "configuration_snapshots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LearnerCapacityBase",
                table: "commercial_product_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LearnerCapacityMax",
                table: "commercial_product_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "VideoStorageGbBase",
                table: "commercial_product_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "VideoStorageGbMax",
                table: "commercial_product_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ExtraLearnerCapacity",
                table: "commercial_pack_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ExtraVideoStorageGb",
                table: "commercial_pack_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "credit_ledger_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Amount = table.Column<int>(type: "integer", nullable: false),
                    SkillKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    OccurredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BillingPeriodId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_ledger_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "skill_credit_costs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Band = table.Column<int>(type: "integer", nullable: true),
                    CreditCost = table.Column<int>(type: "integer", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_skill_credit_costs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_credit_ledger_entries_WorkspaceId_ExpiresAtUtc",
                table: "credit_ledger_entries",
                columns: new[] { "WorkspaceId", "ExpiresAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_skill_credit_costs_SkillKey_Band_EffectiveFrom",
                table: "skill_credit_costs",
                columns: new[] { "SkillKey", "Band", "EffectiveFrom" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "credit_ledger_entries");

            migrationBuilder.DropTable(
                name: "skill_credit_costs");

            migrationBuilder.DropColumn(
                name: "LearnerCapacity",
                table: "configuration_snapshots");

            migrationBuilder.DropColumn(
                name: "VideoStorageGb",
                table: "configuration_snapshots");

            migrationBuilder.DropColumn(
                name: "LearnerCapacityBase",
                table: "commercial_product_versions");

            migrationBuilder.DropColumn(
                name: "LearnerCapacityMax",
                table: "commercial_product_versions");

            migrationBuilder.DropColumn(
                name: "VideoStorageGbBase",
                table: "commercial_product_versions");

            migrationBuilder.DropColumn(
                name: "VideoStorageGbMax",
                table: "commercial_product_versions");

            migrationBuilder.DropColumn(
                name: "ExtraLearnerCapacity",
                table: "commercial_pack_versions");

            migrationBuilder.DropColumn(
                name: "ExtraVideoStorageGb",
                table: "commercial_pack_versions");
        }
    }
}
