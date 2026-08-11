using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordResets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "password_resets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IdentityId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    IssuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_resets", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_password_resets_TokenHash",
                table: "password_resets",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_password_resets_IdentityId",
                table: "password_resets",
                column: "IdentityId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "password_resets");
        }
    }
}
