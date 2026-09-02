using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameWithdrawnToCancelled : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Pure data migration — HasConversion<string>() maps by C# enum
            // member name, and renaming JoinRequestStatus.Withdrawn ->
            // Cancelled / EnrollmentStatus.Withdrawn -> Cancelled changes that
            // mapping without changing any column, so EF's own scaffolding
            // sees no schema difference to generate here. Any row already
            // written with the old member name has to be rewritten by hand,
            // or it stops parsing the moment this deploys.
            migrationBuilder.Sql("UPDATE join_requests SET \"Status\" = 'Cancelled' WHERE \"Status\" = 'Withdrawn';");
            migrationBuilder.Sql("UPDATE enrollments SET \"Status\" = 'Cancelled' WHERE \"Status\" = 'Withdrawn';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not a safe inverse in general — a row that was already
            // Cancelled before this migration ran would be indistinguishable
            // from one this migration itself renamed, so rolling back would
            // incorrectly revert both. Documented rather than guessed: if a
            // rollback of this rename is ever actually needed, it needs a
            // snapshot of which rows this Up() touched, not a blind reverse UPDATE.
        }
    }
}
