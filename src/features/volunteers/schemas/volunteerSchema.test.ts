import { describe, expect, it } from "vitest"

import {
  availabilitySchema,
  consentSchema,
  emergencyContactSchema,
  personalDetailsSchema,
  skillsSchema,
  stepOneSchema,
  stepThreeSchema,
  stepTwoSchema,
  volunteerOnboardingSchema,
  volunteerOnboardingStepSchemas,
  type Availability,
  type Consent,
  type EmergencyContact,
  type PersonalDetails,
  type Skills,
} from "./volunteerSchema"

const validPersonalDetails: PersonalDetails = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "555-123-4567",
  location: "London, UK",
}

const validAvailability: Availability = {
  weekdays: ["monday", "wednesday"],
  shiftPreference: "morning",
}

const validSkills: Skills = {
  skills: ["First aid", "Event setup"],
}

const validEmergencyContact: EmergencyContact = {
  emergencyContactName: "Grace Hopper",
  emergencyContactPhone: "555-987-6543",
  emergencyContactRelationship: "Sister",
}

const validConsent: Consent = {
  agreedToTerms: true,
}

describe("personalDetailsSchema", () => {
  it("accepts valid personal details", () => {
    expect(personalDetailsSchema.safeParse(validPersonalDetails).success).toBe(true)
  })

  it("rejects an empty name with a descriptive message", () => {
    const result = personalDetailsSchema.safeParse({ ...validPersonalDetails, fullName: "" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Full name is required")
  })

  it("rejects a malformed email with a descriptive message", () => {
    const result = personalDetailsSchema.safeParse({ ...validPersonalDetails, email: "not-an-email" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Enter a valid email address")
  })

  it("rejects a malformed phone number with a descriptive message", () => {
    const result = personalDetailsSchema.safeParse({ ...validPersonalDetails, phone: "abc" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Enter a valid phone number")
  })

  it("rejects a missing location with a descriptive message", () => {
    const result = personalDetailsSchema.safeParse({ ...validPersonalDetails, location: "" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Location is required")
  })
})

describe("availabilitySchema", () => {
  it("accepts valid availability", () => {
    expect(availabilitySchema.safeParse(validAvailability).success).toBe(true)
  })

  it("rejects an empty weekdays list with a descriptive message", () => {
    const result = availabilitySchema.safeParse({ ...validAvailability, weekdays: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Select at least one day you're available")
  })

  it("rejects a weekday outside the enum with a descriptive message", () => {
    const result = availabilitySchema.safeParse({ ...validAvailability, weekdays: ["funday"] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Pick a valid weekday")
  })

  it("rejects a shift preference outside the enum with a descriptive message", () => {
    const result = availabilitySchema.safeParse({ ...validAvailability, shiftPreference: "midnight" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Pick a shift preference")
  })
})

describe("skillsSchema", () => {
  it("accepts a non-empty skills list", () => {
    expect(skillsSchema.safeParse(validSkills).success).toBe(true)
  })

  it("rejects an empty skills list with a descriptive message", () => {
    const result = skillsSchema.safeParse({ skills: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Select or enter at least one skill")
  })
})

describe("emergencyContactSchema", () => {
  it("accepts a valid emergency contact", () => {
    expect(emergencyContactSchema.safeParse(validEmergencyContact).success).toBe(true)
  })

  it("rejects a missing emergency contact name with a descriptive message", () => {
    const result = emergencyContactSchema.safeParse({
      ...validEmergencyContact,
      emergencyContactName: "",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Emergency contact name is required")
  })

  it("rejects a malformed emergency contact phone with a descriptive message", () => {
    const result = emergencyContactSchema.safeParse({
      ...validEmergencyContact,
      emergencyContactPhone: "abc",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Enter a valid phone number")
  })

  it("rejects a missing relationship with a descriptive message", () => {
    const result = emergencyContactSchema.safeParse({
      ...validEmergencyContact,
      emergencyContactRelationship: "",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Relationship to emergency contact is required")
  })
})

describe("consentSchema", () => {
  it("accepts agreedToTerms: true", () => {
    expect(consentSchema.safeParse(validConsent).success).toBe(true)
  })

  it("rejects agreedToTerms: false with a descriptive message", () => {
    const result = consentSchema.safeParse({ agreedToTerms: false })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("You must accept the terms to continue")
  })

  it("rejects a missing agreedToTerms field", () => {
    expect(consentSchema.safeParse({}).success).toBe(false)
  })
})

describe("composed step schemas", () => {
  it("stepOneSchema accepts valid personal details and rejects invalid ones", () => {
    expect(stepOneSchema.safeParse(validPersonalDetails).success).toBe(true)
    expect(stepOneSchema.safeParse({ ...validPersonalDetails, email: "bad" }).success).toBe(false)
  })

  it("stepTwoSchema accepts valid availability and rejects invalid ones", () => {
    expect(stepTwoSchema.safeParse(validAvailability).success).toBe(true)
    expect(stepTwoSchema.safeParse({ ...validAvailability, weekdays: [] }).success).toBe(false)
  })

  it("stepThreeSchema accepts the merged skills + emergency contact + consent shape", () => {
    const validStepThree = { ...validSkills, ...validEmergencyContact, ...validConsent }
    expect(stepThreeSchema.safeParse(validStepThree).success).toBe(true)
  })

  it("stepThreeSchema rejects when any one of its merged groups is invalid", () => {
    const missingConsent = { ...validSkills, ...validEmergencyContact, agreedToTerms: false }
    expect(stepThreeSchema.safeParse(missingConsent).success).toBe(false)

    const missingSkills = { ...validEmergencyContact, ...validConsent, skills: [] }
    expect(stepThreeSchema.safeParse(missingSkills).success).toBe(false)
  })

  it("exposes the step schemas in order for direct use with useMultiStepWizard", () => {
    expect(volunteerOnboardingStepSchemas).toHaveLength(3)
    expect(volunteerOnboardingStepSchemas[0]).toBe(stepOneSchema)
    expect(volunteerOnboardingStepSchemas[1]).toBe(stepTwoSchema)
    expect(volunteerOnboardingStepSchemas[2]).toBe(stepThreeSchema)
  })
})

describe("volunteerOnboardingSchema (full combined payload)", () => {
  const validPayload = {
    ...validPersonalDetails,
    ...validAvailability,
    ...validSkills,
    ...validEmergencyContact,
    ...validConsent,
  }

  it("accepts a fully valid combined payload", () => {
    expect(volunteerOnboardingSchema.safeParse(validPayload).success).toBe(true)
  })

  it("rejects when any field from any step is invalid", () => {
    expect(
      volunteerOnboardingSchema.safeParse({ ...validPayload, fullName: "" }).success
    ).toBe(false)
    expect(
      volunteerOnboardingSchema.safeParse({ ...validPayload, weekdays: [] }).success
    ).toBe(false)
    expect(
      volunteerOnboardingSchema.safeParse({ ...validPayload, agreedToTerms: false }).success
    ).toBe(false)
  })
})

describe("independent regroupability", () => {
  it("allows composing a unit into a brand new grouping without touching the originals", () => {
    // Proves the five units aren't hard-wired to the current three-step
    // split - any other combination still works on its own.
    const adHocGroup = personalDetailsSchema.merge(consentSchema)

    expect(
      adHocGroup.safeParse({ ...validPersonalDetails, ...validConsent }).success
    ).toBe(true)
    expect(adHocGroup.safeParse({ ...validPersonalDetails, agreedToTerms: false }).success).toBe(
      false
    )

    // The originals are unaffected by having been composed elsewhere.
    expect(personalDetailsSchema.safeParse(validPersonalDetails).success).toBe(true)
    expect(consentSchema.safeParse(validConsent).success).toBe(true)
  })
})
