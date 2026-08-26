using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSignupPaymentGate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaidAt",
                table: "signup_requests");

            migrationBuilder.DropColumn(
                name: "Payment",
                table: "signup_requests");

            migrationBuilder.DropColumn(
                name: "PaymentWindowEndsAt",
                table: "signup_requests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PaidAt",
                table: "signup_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Payment",
                table: "signup_requests",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentWindowEndsAt",
                table: "signup_requests",
                type: "timestamp with time zone",
                nullable: true);
        }
    }
}
