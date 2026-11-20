import { describe, expect, it } from "vitest";
import { z } from "zod";
import { resetPasswordSchema } from "./authSchema";

describe("resetPasswordSchema", () => {
  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "password123",
      confirmPassword: "password456",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = z.flattenError(result.error).fieldErrors;
      expect(fieldErrors.confirmPassword).toBeDefined();
    }
  });

  it("accepts matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(true);
  });
});
