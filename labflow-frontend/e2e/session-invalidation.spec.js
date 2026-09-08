import process from "node:process";
import { test, expect } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const sessionUserEmail = process.env.E2E_SESSION_USER_EMAIL;
const sessionUserPassword = process.env.E2E_SESSION_USER_PASSWORD;

const apiBaseUrl = process.env.E2E_API_URL || "http://localhost:5000/api";

const requireCredentials = () => {
  if (
    !adminEmail ||
    !adminPassword ||
    !sessionUserEmail ||
    !sessionUserPassword
  ) {
    throw new Error(
      "E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_SESSION_USER_EMAIL, and E2E_SESSION_USER_PASSWORD must be set.",
    );
  }
};

const logInThroughUi = async (page, email, password) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
};

test.describe("session invalidation", () => {
  test("invalidated session is redirected to login", async ({
    page,
    request,
  }) => {
    requireCredentials();

    await logInThroughUi(page, sessionUserEmail, sessionUserPassword);

    const adminLoginResponse = await request.post(`${apiBaseUrl}/auth/login`, {
      data: {
        email: adminEmail,
        password: adminPassword,
      },
    });

    expect(adminLoginResponse.ok()).toBeTruthy();

    const adminLoginBody = await adminLoginResponse.json();
    const adminToken = adminLoginBody.data?.token;

    expect(adminToken).toBeTruthy();

    const usersResponse = await request.get(`${apiBaseUrl}/users`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(usersResponse.ok()).toBeTruthy();

    const usersBody = await usersResponse.json();

    const sessionUser = usersBody.data?.users?.find(
      (user) => user.email === sessionUserEmail,
    );

    expect(sessionUser?.id).toBeTruthy();

    let userWasDeactivated = false;

    try {
      const deactivateResponse = await request.patch(
        `${apiBaseUrl}/users/${sessionUser.id}/status`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          data: {
            isActive: false,
          },
        },
      );

      expect(deactivateResponse.ok()).toBeTruthy();

      userWasDeactivated = true;

      await page.goto("/projects");

      await expect(page).toHaveURL(/\/login$/, {
        timeout: 10_000,
      });

      await expect(
        page.getByRole("heading", {
          name: "Log In to LabFlow",
        }),
      ).toBeVisible();

      const storedToken = await page.evaluate(() => {
        return localStorage.getItem("labflow_token");
      });

      expect(storedToken).toBeNull();

      await expect(
        page.getByText("Your session is no longer valid. Please log in again."),
      ).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      if (userWasDeactivated) {
        const reactivateResponse = await request.patch(
          `${apiBaseUrl}/users/${sessionUser.id}/status`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
            data: {
              isActive: true,
            },
          },
        );

        expect(reactivateResponse.ok()).toBeTruthy();
      }
    }
  });
});
