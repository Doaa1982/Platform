using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Platform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCurriculumUniqueActivePerProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_curricula_LearningProductId",
                table: "curricula");

            migrationBuilder.CreateIndex(
                name: "IX_curricula_LearningProductId",
                table: "curricula",
                column: "LearningProductId",
                unique: true,
                filter: "\"Status\" != 'Archived'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_curricula_LearningProductId",
                table: "curricula");

            migrationBuilder.CreateIndex(
                name: "IX_curricula_LearningProductId",
                table: "curricula",
                column: "LearningProductId");
        }
    }
}
