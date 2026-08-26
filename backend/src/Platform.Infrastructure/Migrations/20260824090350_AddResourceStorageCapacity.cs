using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddResourceStorageCapacity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ResourceStorageGb",
                table: "configuration_snapshots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ResourceStorageGbBase",
                table: "commercial_product_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ResourceStorageGbMax",
                table: "commercial_product_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ExtraResourceStorageGb",
                table: "commercial_pack_versions",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResourceStorageGb",
                table: "configuration_snapshots");

            migrationBuilder.DropColumn(
                name: "ResourceStorageGbBase",
                table: "commercial_product_versions");

            migrationBuilder.DropColumn(
                name: "ResourceStorageGbMax",
                table: "commercial_product_versions");

            migrationBuilder.DropColumn(
                name: "ExtraResourceStorageGb",
                table: "commercial_pack_versions");
        }
    }
}
