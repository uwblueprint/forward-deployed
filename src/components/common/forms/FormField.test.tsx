import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("renders the label", () => {
    render(<FormField label="Email" name="email" type="email" />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("does not set aria-invalid or aria-describedby when there's no error", () => {
    render(<FormField label="Email" name="email" type="email" />);

    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("sets aria-invalid and aria-describedby when there's an error", () => {
    render(
      <FormField
        label="Email"
        name="email"
        type="email"
        error="Enter a valid email address."
      />,
    );

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
    expect(input).toHaveAccessibleDescription("Enter a valid email address.");
  });
});
