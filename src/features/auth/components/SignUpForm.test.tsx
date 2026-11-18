import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpAction = vi.fn();

vi.mock("../api/actions", () => ({
  signUpAction: (...args: unknown[]) => signUpAction(...args),
}));

import { SignUpForm } from "./SignUpForm";

beforeEach(() => {
  signUpAction.mockReset();
});

describe("SignUpForm", () => {
  it("renders the firstName, lastName, email, and password fields", () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
  });

  it("links to login", () => {
    render(<SignUpForm />);

    expect(
      screen.getByRole("link", { name: "Already have an account? Log in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("shows field errors from the returned state", async () => {
    signUpAction.mockResolvedValue({
      status: "error",
      fieldErrors: {
        firstName: ["First name is required."],
        lastName: ["Last name is required."],
        email: ["Enter a valid email address."],
        password: ["Password must be at least 8 characters."],
      },
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("First name is required."),
    ).toBeInTheDocument();
    expect(screen.getByText("Last name is required.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("First name")).toHaveAttribute(
      "aria-describedby",
      "firstName-error",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows the backend error from the returned state", async () => {
    signUpAction.mockResolvedValue({
      status: "error",
      message: "User already registered",
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("User already registered"),
    ).toBeInTheDocument();
  });

  it("keeps the name and email values after a failed submission", async () => {
    signUpAction.mockResolvedValue({
      status: "error",
      message: "User already registered",
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("First name"), "Jane");
    await user.type(screen.getByLabelText("Last name"), "Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await screen.findByText("User already registered");

    expect(screen.getByLabelText("First name")).toHaveValue("Jane");
    expect(screen.getByLabelText("Last name")).toHaveValue("Doe");
    expect(screen.getByLabelText("Email")).toHaveValue("jane@example.com");
  });

  it("shows the check-your-email message on success", async () => {
    signUpAction.mockResolvedValue({
      status: "success",
      message: "Check your email to confirm your account.",
    });

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("Check your email to confirm your account."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create account" }),
    ).not.toBeInTheDocument();
  });

  it("disables the submit button and changes its text while pending", async () => {
    let resolveAction: (value: { status: "idle" }) => void = () => {};
    signUpAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    const button = screen.getByRole("button", {
      name: "Creating account...",
    });
    expect(button).toBeDisabled();

    await act(async () => {
      resolveAction({ status: "idle" });
    });
  });
});
