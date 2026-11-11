import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPasswordResetAction = vi.fn();
const verifyResetCodeAction = vi.fn();
const updatePasswordAction = vi.fn();

vi.mock("../api/actions", () => ({
  requestPasswordResetAction: (...args: unknown[]) =>
    requestPasswordResetAction(...args),
  verifyResetCodeAction: (...args: unknown[]) =>
    verifyResetCodeAction(...args),
  updatePasswordAction: (...args: unknown[]) =>
    updatePasswordAction(...args),
}));

import { ForgotPasswordFlow } from "./forgot-password-flow";

beforeEach(() => {
  requestPasswordResetAction.mockReset();
  verifyResetCodeAction.mockReset();
  updatePasswordAction.mockReset();
});

describe("ForgotPasswordFlow", () => {
  it("advances from the email step to the code step on success", async () => {
    requestPasswordResetAction.mockResolvedValue({
      status: "success",
      message: "If an account exists for that email, we've sent a code.",
    });

    const user = userEvent.setup();
    render(<ForgotPasswordFlow />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(
      await screen.findByText(
        "If an account exists for that email, we've sent a code.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Enter the code" }),
    ).toBeInTheDocument();
  });

  it("shows a field error on the email step without advancing", async () => {
    requestPasswordResetAction.mockResolvedValue({
      status: "error",
      fieldErrors: { email: ["Enter a valid email address."] },
    });

    const user = userEvent.setup();
    render(<ForgotPasswordFlow />);

    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Enter the code" }),
    ).not.toBeInTheDocument();
  });

  it("shows a backend error on the code step without advancing", async () => {
    requestPasswordResetAction.mockResolvedValue({
      status: "success",
      message: "If an account exists for that email, we've sent a code.",
    });
    verifyResetCodeAction.mockResolvedValue({
      status: "error",
      message: "That code is incorrect or has expired.",
    });

    const user = userEvent.setup();
    render(<ForgotPasswordFlow />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByRole("heading", { name: "Enter the code" });

    await user.type(screen.getByLabelText("Code"), "000000");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    expect(
      await screen.findByText("That code is incorrect or has expired."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Choose a new password" }),
    ).not.toBeInTheDocument();
  });

  it("advances to the password step once the code is verified", async () => {
    requestPasswordResetAction.mockResolvedValue({
      status: "success",
      message: "If an account exists for that email, we've sent a code.",
    });
    verifyResetCodeAction.mockResolvedValue({ status: "success" });

    const user = userEvent.setup();
    render(<ForgotPasswordFlow />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByRole("heading", { name: "Enter the code" });

    await user.type(screen.getByLabelText("Code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    expect(
      await screen.findByRole("heading", { name: "Choose a new password" }),
    ).toBeInTheDocument();
  });

  it("returns to the email step when Start over is clicked on the code step", async () => {
    requestPasswordResetAction.mockResolvedValue({
      status: "success",
      message: "If an account exists for that email, we've sent a code.",
    });

    const user = userEvent.setup();
    render(<ForgotPasswordFlow />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByRole("heading", { name: "Enter the code" });

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(
      screen.getByRole("heading", { name: "Forgot password" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Enter the code" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("disables the submit button while the action is pending", async () => {
    let resolveAction: (value: { status: "idle" }) => void = () => {};
    requestPasswordResetAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<ForgotPasswordFlow />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();

    await act(async () => {
      resolveAction({ status: "idle" });
    });
  });
});
