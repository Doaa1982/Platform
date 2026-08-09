using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProductVersionId",
                table: "configuration_snapshots",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid[]>(
                name: "SelectedPackVersionIds",
                table: "configuration_snapshots",
                type: "uuid[]",
                nullable: false,
                defaultValue: new Guid[0]);

            migrationBuilder.CreateTable(
                name: "commercial_pack_versions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PackId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MonthlyPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    LearningGrant = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    AssessmentGrant = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    AnalyticsGrant = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    BrandingGrant = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    ExtraTutorCapacity = table.Column<int>(type: "integer", nullable: false),
                    RequiresDomain = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    RequiresMinLevel = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RetiredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commercial_pack_versions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "commercial_packs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commercial_packs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "commercial_product_versions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MonthlyPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    AnnualPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    TutorCapacityBase = table.Column<int>(type: "integer", nullable: false),
                    TutorCapacityMax = table.Column<int>(type: "integer", nullable: false),
                    AiCreditsIncluded = table.Column<int>(type: "integer", nullable: false),
                    LearningProfile = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AssessmentProfile = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AnalyticsProfile = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    BrandingProfile = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RetiredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commercial_product_versions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "commercial_products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductFamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commercial_products", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product_families",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_families", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_configuration_snapshots_ProductVersionId",
                table: "configuration_snapshots",
                column: "ProductVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_commercial_pack_versions_PackId_Status",
                table: "commercial_pack_versions",
                columns: new[] { "PackId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_commercial_pack_versions_PackId_VersionNumber",
                table: "commercial_pack_versions",
                columns: new[] { "PackId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_commercial_packs_Code",
                table: "commercial_packs",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_commercial_product_versions_ProductId_Status",
                table: "commercial_product_versions",
                columns: new[] { "ProductId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_commercial_product_versions_ProductId_VersionNumber",
                table: "commercial_product_versions",
                columns: new[] { "ProductId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_commercial_products_Code",
                table: "commercial_products",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_families_Code",
                table: "product_families",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "commercial_pack_versions");

            migrationBuilder.DropTable(
                name: "commercial_packs");

            migrationBuilder.DropTable(
                name: "commercial_product_versions");

            migrationBuilder.DropTable(
                name: "commercial_products");

            migrationBuilder.DropTable(
                name: "product_families");

            migrationBuilder.DropIndex(
                name: "IX_configuration_snapshots_ProductVersionId",
                table: "configuration_snapshots");

            migrationBuilder.DropColumn(
                name: "ProductVersionId",
                table: "configuration_snapshots");

            migrationBuilder.DropColumn(
                name: "SelectedPackVersionIds",
                table: "configuration_snapshots");
        }
    }
}
