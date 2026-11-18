import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInAction = vi.fn();

vi.mock("../api/actions", () => ({
  signInAction: (...args: unknown[]) => signInAction(...args),
}));

import { SignInForm } from "./SignInForm";

beforeEach(() => {
  signInAction.mockReset();
});

describe("SignInForm", () => {
  it("renders the email and password fields", () => {
    render(<SignInForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();
  });

  it("links to forgot password and register", () => {
    render(<SignInForm />);

    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/register");
  });

  it("shows field errors from the returned state", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      fieldErrors: {
        email: ["Enter a valid email address."],
        password: ["Password is required."],
      },
    });

    const user = userEvent.setup();
    render(<SignInForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const emailInput = await screen.findByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput).toHaveAttribute("aria-describedby", "email-error");
    expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput).toHaveAttribute(
      "aria-describedby",
      "password-error",
    );
  });

  it("shows the backend error from the returned state", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      message: "Invalid login credentials",
    });

    const user = userEvent.setup();
    render(<SignInForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid login credentials"),
    ).toBeInTheDocument();
  });

  it("keeps the email value after a failed submission", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      message: "Invalid login credentials",
    });

    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByText("Invalid login credentials");

    expect(screen.getByLabelText("Email")).toHaveValue("person@example.com");
  });

  it("disables the submit button and changes its text while pending", async () => {
    let resolveAction: (value: { status: "idle" }) => void = () => {};
    signInAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<SignInForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const button = screen.getByRole("button", { name: "Signing in..." });
    expect(button).toBeDisabled();

    await act(async () => {
      resolveAction({ status: "idle" });
    });
  });
});
