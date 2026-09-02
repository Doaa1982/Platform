using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOpenRequestUniqueIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_join_requests_Email_WorkspaceId",
                table: "join_requests");

            migrationBuilder.DropIndex(
                name: "IX_invitations_Email_WorkspaceId",
                table: "invitations");

            migrationBuilder.DropIndex(
                name: "IX_course_join_requests_LearningProductId_MembershipId",
                table: "course_join_requests");

            migrationBuilder.CreateIndex(
                name: "IX_join_requests_Email_WorkspaceId",
                table: "join_requests",
                columns: new[] { "Email", "WorkspaceId" },
                unique: true,
                filter: "\"Status\" = 'Submitted'");

            migrationBuilder.CreateIndex(
                name: "IX_invitations_Email_WorkspaceId",
                table: "invitations",
                columns: new[] { "Email", "WorkspaceId" },
                unique: true,
                filter: "\"Status\" = 'Sent'");

            migrationBuilder.CreateIndex(
                name: "IX_course_join_requests_LearningProductId_MembershipId",
                table: "course_join_requests",
                columns: new[] { "LearningProductId", "MembershipId" },
                unique: true,
                filter: "\"Status\" = 'Submitted'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_join_requests_Email_WorkspaceId",
                table: "join_requests");

            migrationBuilder.DropIndex(
                name: "IX_invitations_Email_WorkspaceId",
                table: "invitations");

            migrationBuilder.DropIndex(
                name: "IX_course_join_requests_LearningProductId_MembershipId",
                table: "course_join_requests");

            migrationBuilder.CreateIndex(
                name: "IX_join_requests_Email_WorkspaceId",
                table: "join_requests",
                columns: new[] { "Email", "WorkspaceId" });

            migrationBuilder.CreateIndex(
                name: "IX_invitations_Email_WorkspaceId",
                table: "invitations",
                columns: new[] { "Email", "WorkspaceId" });

            migrationBuilder.CreateIndex(
                name: "IX_course_join_requests_LearningProductId_MembershipId",
                table: "course_join_requests",
                columns: new[] { "LearningProductId", "MembershipId" });
        }
    }
}
