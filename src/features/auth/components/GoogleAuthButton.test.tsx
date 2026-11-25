import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  }),
}));

import { GoogleAuthButton } from "./GoogleAuthButton";

beforeEach(() => {
  signInWithOAuth.mockReset();
});

describe("GoogleAuthButton", () => {
  it("starts the Google OAuth flow with the callback redirect", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });

  it("appends an encoded next to the callback redirect when provided", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<GoogleAuthButton next="/auth/invite?token=a&b" />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/invite?token=a&b")}`,
      },
    });
  });

  it("shows the error returned by signInWithOAuth", async () => {
    signInWithOAuth.mockResolvedValue({
      error: { message: "Unable to reach Google" },
    });

    const user = userEvent.setup();
    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(
      await screen.findByText("Unable to reach Google"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).not.toBeDisabled();
  });

  it("disables the button while the request is pending", async () => {
    let resolveCall: (value: { error: null }) => void = () => {};
    signInWithOAuth.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeDisabled();

    await act(async () => {
      resolveCall({ error: null });
    });
  });

  it("shows a generic error when the request throws", async () => {
    signInWithOAuth.mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    render(<GoogleAuthButton />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(
      await screen.findByText("Couldn't start Google sign-in. Try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).not.toBeDisabled();
  });
});
