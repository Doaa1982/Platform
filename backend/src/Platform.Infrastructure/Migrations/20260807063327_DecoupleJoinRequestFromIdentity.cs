using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DecoupleJoinRequestFromIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_join_requests_IdentityId_WorkspaceId",
                table: "join_requests");

            migrationBuilder.DropColumn(
                name: "IdentityId",
                table: "join_requests");

            migrationBuilder.CreateIndex(
                name: "IX_join_requests_Email_WorkspaceId",
                table: "join_requests",
                columns: new[] { "Email", "WorkspaceId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_join_requests_Email_WorkspaceId",
                table: "join_requests");

            migrationBuilder.AddColumn<Guid>(
                name: "IdentityId",
                table: "join_requests",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_join_requests_IdentityId_WorkspaceId",
                table: "join_requests",
                columns: new[] { "IdentityId", "WorkspaceId" });
        }
    }
}
