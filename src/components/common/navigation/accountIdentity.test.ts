import { describe, expect, it } from "vitest"

import { accountIdentity } from "./accountIdentity"

describe("accountIdentity", () => {
  it("prefers full_name", () => {
    expect(
      accountIdentity({ email: "fw@uwblueprint.org", user_metadata: { full_name: "Famay Wuong" } })
    ).toEqual({ name: "Famay Wuong", email: "fw@uwblueprint.org" })
  })

  it("uses first_name and last_name from sign-up when there is no full_name", () => {
    expect(accountIdentity({ email: "j@x.org", user_metadata: { first_name: "Jane", last_name: "Doe" } }).name).toBe(
      "Jane Doe"
    )
    expect(accountIdentity({ email: "j@x.org", user_metadata: { first_name: " Jane " } }).name).toBe("Jane")
  })

  it("falls back to the email's local part, then 'Account'", () => {
    expect(accountIdentity({ email: "fw@uwblueprint.org", user_metadata: { full_name: " " } }).name).toBe("fw")
    expect(accountIdentity({})).toEqual({ name: "Account", email: "" })
  })
})
