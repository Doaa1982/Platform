using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCreditLedgerIdempotencyFingerprint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdempotencyFingerprint",
                table: "credit_ledger_entries",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_credit_ledger_entries_WorkspaceId_IdempotencyFingerprint",
                table: "credit_ledger_entries",
                columns: new[] { "WorkspaceId", "IdempotencyFingerprint" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_credit_ledger_entries_WorkspaceId_IdempotencyFingerprint",
                table: "credit_ledger_entries");

            migrationBuilder.DropColumn(
                name: "IdempotencyFingerprint",
                table: "credit_ledger_entries");
        }
    }
}
