using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntegratedProcurement.Platform.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserManagerReporting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ManagerUserId",
                schema: "iam",
                table: "USER_T",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_T_MANAGER",
                schema: "iam",
                table: "USER_T",
                column: "ManagerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_USER_T_USER_T_MANAGER_USER_ID",
                schema: "iam",
                table: "USER_T",
                column: "ManagerUserId",
                principalSchema: "iam",
                principalTable: "USER_T",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_USER_T_USER_T_MANAGER_USER_ID",
                schema: "iam",
                table: "USER_T");

            migrationBuilder.DropIndex(
                name: "IX_USER_T_MANAGER",
                schema: "iam",
                table: "USER_T");

            migrationBuilder.DropColumn(
                name: "ManagerUserId",
                schema: "iam",
                table: "USER_T");
        }
    }
}
