import process from "node:process";
import { test, expect } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function logInAsAdmin(page) {
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set before running E2E tests.",
    );
  }

  await page.goto("/login");

  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);

  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("authenticated workspace", () => {
  test("admin can open Projects", async ({ page }) => {
    await logInAsAdmin(page);

    await page.getByRole("menuitem", { name: "Projects" }).click();

    await expect(page).toHaveURL(/\/projects$/);
  });

  test("admin can open Tasks", async ({ page }) => {
    await logInAsAdmin(page);

    await page.getByRole("menuitem", { name: "Tasks" }).click();

    await expect(page).toHaveURL(/\/tasks$/);
  });
});
