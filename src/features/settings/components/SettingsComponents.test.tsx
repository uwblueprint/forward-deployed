import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { actions, refresh } = vi.hoisted(() => ({
  actions: {
    updateOrganizationSettingsAction: vi.fn(),
    createCustomFieldAction: vi.fn(),
    updateCustomFieldAction: vi.fn(),
    deleteCustomFieldAction: vi.fn(),
    reorderCustomFieldsAction: vi.fn(),
  },
  refresh: vi.fn(),
}))

vi.mock("../api/actions", () => actions)
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

import type { CustomQuestion } from "../api/adminContext"
import { CustomQuestionsEditor } from "./CustomQuestionsEditor"
import { OrganizationSettingsForm } from "./OrganizationSettingsForm"

const organization = {
  name: "Food Bank",
  defaultRejectionMessage: null,
  eventCategories: ["Tutoring"],
  skills: ["Driving"],
}

const questions: CustomQuestion[] = [
  { id: "q1", fieldName: "Why do you want to volunteer?", fieldType: "textarea", required: true, options: [], position: 0 },
  { id: "q2", fieldName: "T-shirt size", fieldType: "select", required: false, options: ["S", "M"], position: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe("OrganizationSettingsForm", () => {
  it("saves the edited name, message, and lists", async () => {
    const user = userEvent.setup()
    actions.updateOrganizationSettingsAction.mockImplementation(async (input) => ({ ok: true, data: input }))
    render(<OrganizationSettingsForm organization={organization} />)

    await user.clear(screen.getByLabelText("Organization name"))
    await user.type(screen.getByLabelText("Organization name"), "Waterloo Food Bank")
    await user.type(screen.getByLabelText("Default rejection message"), "Thanks for applying.")
    await user.type(screen.getByLabelText("Event categories"), "Environment{Enter}")
    await user.click(screen.getByRole("button", { name: "Remove Driving" }))
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(actions.updateOrganizationSettingsAction).toHaveBeenCalledWith({
      name: "Waterloo Food Bank",
      defaultRejectionMessage: "Thanks for applying.",
      eventCategories: ["Tutoring", "Environment"],
      skills: [],
    })
    expect(await screen.findByText("Saved.")).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it("doesn't add the same entry twice", async () => {
    const user = userEvent.setup()
    render(<OrganizationSettingsForm organization={organization} />)

    await user.type(screen.getByLabelText("Event categories"), "tutoring{Enter}")

    expect(screen.getByText('"tutoring" is already in the list')).toBeInTheDocument()
    expect(within(screen.getByRole("list", { name: "category list" })).getAllByRole("listitem")).toHaveLength(1)
  })

  it("shows field errors from the server", async () => {
    const user = userEvent.setup()
    actions.updateOrganizationSettingsAction.mockResolvedValue({
      ok: false,
      error: { type: "validation", fieldErrors: { name: ["Enter the organization's name"] } },
    })
    render(<OrganizationSettingsForm organization={organization} />)

    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(await screen.findByText("Enter the organization's name")).toBeInTheDocument()
    expect(screen.getByLabelText("Organization name")).toHaveAttribute("aria-invalid", "true")
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe("CustomQuestionsEditor", () => {
  it("lists questions in order with their type and whether they're required", () => {
    render(<CustomQuestionsEditor entityType="application" questions={questions} />)

    const items = screen.getAllByRole("listitem").filter((item) => item.closest("ol"))
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("1. Why do you want to volunteer?Paragraph")
    expect(items[1]).toHaveTextContent("2. T-shirt sizeDropdown (pick one)")
    expect(within(items[0]).getByText("Required")).toBeInTheDocument()
    expect(within(items[1]).getByText("Options: S, M")).toBeInTheDocument()
  })

  it("moves a question down", async () => {
    const user = userEvent.setup()
    actions.reorderCustomFieldsAction.mockResolvedValue({ ok: true, data: { ids: ["q2", "q1"] } })
    render(<CustomQuestionsEditor entityType="application" questions={questions} />)

    expect(screen.getByRole("button", { name: 'Move "Why do you want to volunteer?" up' })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: 'Move "Why do you want to volunteer?" down' }))

    expect(actions.reorderCustomFieldsAction).toHaveBeenCalledWith({ entityType: "application", ids: ["q2", "q1"] })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it("adds a required question", async () => {
    const user = userEvent.setup()
    actions.createCustomFieldAction.mockResolvedValue({ ok: true, data: { ...questions[0], id: "q3" } })
    render(<CustomQuestionsEditor entityType="registration" questions={[]} />)

    expect(screen.getByText("No event signup questions yet.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add question" }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText("Question"), "Dietary restrictions")
    await user.click(within(dialog).getByRole("checkbox", { name: "Required" }))
    await user.click(within(dialog).getByRole("button", { name: "Add question" }))

    expect(actions.createCustomFieldAction).toHaveBeenCalledWith({
      entityType: "registration",
      fieldName: "Dietary restrictions",
      fieldType: "text",
      required: true,
      options: [],
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(refresh).toHaveBeenCalled()
  })

  it("keeps the dialog open and shows what's wrong", async () => {
    const user = userEvent.setup()
    actions.updateCustomFieldAction.mockResolvedValue({
      ok: false,
      error: { type: "validation", fieldErrors: { options: ["Add at least one option"] } },
    })
    render(<CustomQuestionsEditor entityType="application" questions={questions} />)

    await user.click(screen.getByRole("button", { name: 'Edit "T-shirt size"' }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Remove S" }))
    await user.click(within(dialog).getByRole("button", { name: "Remove M" }))
    await user.click(within(dialog).getByRole("button", { name: "Save question" }))

    expect(actions.updateCustomFieldAction).toHaveBeenCalledWith("q2", {
      fieldName: "T-shirt size",
      fieldType: "select",
      required: false,
      options: [],
    })
    expect(await within(dialog).findByText("Add at least one option")).toBeInTheDocument()
  })

  it("removes a question after confirming", async () => {
    const user = userEvent.setup()
    actions.deleteCustomFieldAction.mockResolvedValue({ ok: true, data: { id: "q1" } })
    render(<CustomQuestionsEditor entityType="application" questions={questions} />)

    await user.click(screen.getByRole("button", { name: 'Remove "Why do you want to volunteer?"' }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Remove question" }))

    expect(actions.deleteCustomFieldAction).toHaveBeenCalledWith("q1")
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})
