using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStatusLinkToJoinRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "TokenExpiresAt",
                table: "join_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TokenHash",
                table: "join_requests",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_join_requests_TokenHash",
                table: "join_requests",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_join_requests_TokenHash",
                table: "join_requests");

            migrationBuilder.DropColumn(
                name: "TokenExpiresAt",
                table: "join_requests");

            migrationBuilder.DropColumn(
                name: "TokenHash",
                table: "join_requests");
        }
    }
}
