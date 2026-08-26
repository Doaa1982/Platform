using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionEventSnapshotDiff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "NewConfigurationSnapshotId",
                table: "subscription_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PreviousConfigurationSnapshotId",
                table: "subscription_events",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NewConfigurationSnapshotId",
                table: "subscription_events");

            migrationBuilder.DropColumn(
                name: "PreviousConfigurationSnapshotId",
                table: "subscription_events");
        }
    }
}
