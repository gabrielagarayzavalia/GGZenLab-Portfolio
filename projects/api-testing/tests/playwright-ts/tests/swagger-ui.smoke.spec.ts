import { test } from "@playwright/test";
import { SwaggerUiPage } from "../pages/SwaggerUiPage";

test.describe("Swagger UI smoke — ABM CRUD SUT", () => {
  test("AC-001 UI: Swagger muestra operación POST /api/items", async ({ page }) => {
    const swagger = new SwaggerUiPage(page);
    await swagger.open();
    await swagger.expectDocumentsItemsResource();
    await swagger.expectShowsPostOperation();
  });

  test("AC-003 UI: Swagger muestra GET listado", async ({ page }) => {
    const swagger = new SwaggerUiPage(page);
    await swagger.open();
    await swagger.expectShowsGetOperation();
  });
});