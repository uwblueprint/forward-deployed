import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserRole } = vi.hoisted(() => ({ getUserRole: vi.fn() }));

vi.mock("./requireRole", () => ({ getUserRole }));

import { resolveRoleRedirect } from "./resolveRoleRedirect";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveRoleRedirect", () => {
  it("sends admins to /admin/dashboard", async () => {
    getUserRole.mockResolvedValue("admin");

    await expect(resolveRoleRedirect({ id: "user-1" } as never)).resolves.toBe("/admin/dashboard");
  });

  it("sends managers to /admin/dashboard", async () => {
    getUserRole.mockResolvedValue("manager");

    await expect(resolveRoleRedirect({ id: "user-1" } as never)).resolves.toBe("/admin/dashboard");
  });

  it("sends volunteers to /dashboard", async () => {
    getUserRole.mockResolvedValue("volunteer");

    await expect(resolveRoleRedirect({ id: "user-1" } as never)).resolves.toBe("/dashboard");
  });

  it("fails closed to /dashboard when getUserRole returns null", async () => {
    getUserRole.mockResolvedValue(null);

    await expect(resolveRoleRedirect({ id: "user-1" } as never)).resolves.toBe("/dashboard");
  });
});
