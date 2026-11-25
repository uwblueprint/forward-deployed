import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInAction = vi.fn();
const signInWithOAuth = vi.fn();

vi.mock("../api/actions", () => ({
  signInAction: (...args: unknown[]) => signInAction(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args) },
  }),
}));

import { SignInForm } from "./SignInForm";

beforeEach(() => {
  signInAction.mockReset();
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({ error: null });
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

  it("renders the Google sign-in button", () => {
    render(<SignInForm />);

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
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

  it("includes an empty hidden next field when no next is passed", () => {
    render(<SignInForm />);

    expect(document.querySelector('input[name="next"]')).toHaveValue("");
  });

  it("includes the next value in a hidden field and forwards it to register", () => {
    render(<SignInForm next="/auth/invite?token=abc" />);

    expect(document.querySelector('input[name="next"]')).toHaveValue(
      "/auth/invite?token=abc",
    );
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute(
      "href",
      `/register?next=${encodeURIComponent("/auth/invite?token=abc")}`,
    );
  });

  it("passes next through to the Google sign-in button", async () => {
    const user = userEvent.setup();
    render(<SignInForm next="/auth/invite?token=abc" />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/invite?token=abc")}`,
      },
    });
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
