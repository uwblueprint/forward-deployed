"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, CalendarIcon, CircleCheckIcon, InfoIcon, MapPinIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { validateCustomFieldAnswers } from "@/lib/customFieldAnswers"

import { cancelRegistrationAction, registerForEventAction } from "../api/actions"
import type { EventDetails, MyRegistration } from "../api/eventDetails"
import { deriveEventState } from "../utils/eventState"
import { formatEventDay, formatEventTimeRange } from "../utils/formatEvent"
import { EventStatusChip, eventChip } from "./EventStatusChip"
import type { QuestionValues } from "./RegistrationQuestions"
import { RegistrationQuestions, toAnswers } from "./RegistrationQuestions"
import {
  GENERIC_ERROR,
  cancellationErrorMessage,
  ineligibleMessage,
  registrationErrorMessage,
} from "./registrationMessages"

type Feedback = { tone: "success" | "error" | "info"; message: string }

interface EventDetailProps extends EventDetails {
  /** The server's clock at render, so server and client agree on open/closed. */
  now: number
  /** 1 on the standalone page, 2 inside the modal (whose dialog title is the h1-equivalent). */
  headingLevel?: 1 | 2
  className?: string
}

const CLOSED_LABELS = {
  closed: "Registration closed",
  full: "Event full",
  unavailable: "Unavailable",
} as const

/**
 * Figma "Event-modal": step 1 shows the event, step 2 asks the
 * organization's registration questions (skipped when there are none),
 * step 3 is the registered state with cancel. Used both in the modal and on
 * the standalone /events/[id] page.
 */
export function EventDetail({
  event,
  questions,
  registration: initialRegistration,
  volunteerStatus,
  now,
  headingLevel = 2,
  className,
}: EventDetailProps) {
  const router = useRouter()

  // Local after a register/cancel; follows the server again after router.refresh().
  const [registration, setRegistration] = useState<MyRegistration | null>(initialRegistration)
  const [syncedRegistration, setSyncedRegistration] = useState(initialRegistration)
  if (initialRegistration !== syncedRegistration) {
    setSyncedRegistration(initialRegistration)
    setRegistration(initialRegistration)
  }

  const [step, setStep] = useState<"details" | "questions">("details")
  const [values, setValues] = useState<QuestionValues>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState<"register" | "cancel" | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // A cancelled or completed event offers no actions, registered or not.
  const eventOver = event.status === "cancelled" || event.status === "completed"
  const registered = registration?.status === "registered"
  // Re-registering keeps the original answers (registerForEvent never
  // rewrites them), so a returning volunteer skips the questions.
  const returning = registration?.status === "cancelled"
  const eligible = volunteerStatus === "approved"
  const state = deriveEventState(event, now).registration
  const canRegister = !eventOver && !registered && eligible && state === "open"
  const chip = eventChip(event, state, { eligible, registered, spotsSuffix: " available" })
  const blockedReason = eventOver
    ? event.status === "cancelled"
      ? "This event was cancelled."
      : "This event has ended."
    : registered || state !== "open"
      ? null
      : ineligibleMessage(volunteerStatus)
  const Title = headingLevel === 1 ? "h1" : "h2"

  async function submitRegistration() {
    const answers = returning ? {} : toAnswers(questions, values)
    const checked = validateCustomFieldAnswers(returning ? [] : questions, answers)
    if (!checked.ok) {
      setFieldErrors(checked.fieldErrors)
      setFeedback({ tone: "error", message: "Check your answers and try again." })
      return
    }

    setBusy("register")
    setFeedback(null)
    setFieldErrors({})
    try {
      const result = await registerForEventAction(event.id, answers)
      if (result.ok) {
        setRegistration({ id: result.data.id, status: "registered" })
        setStep("details")
        setValues({})
        setFeedback({ tone: "success", message: "You're registered! We'll see you there." })
        router.refresh()
        return
      }

      const { error } = result
      if (error.type === "validation") {
        // "answers" is the database's own check; its message isn't for users.
        const { answers: databaseCheck, ...perQuestion } = error.fieldErrors
        setFieldErrors(perQuestion)
        setFeedback({
          tone: "error",
          message:
            databaseCheck && Object.keys(perQuestion).length === 0
              ? "The registration questions changed. Refresh the page and try again."
              : registrationErrorMessage(error, volunteerStatus),
        })
        return
      }
      if (error.type === "already-registered" || error.type === "full" || error.type === "not-eligible") {
        router.refresh()
      }
      setFeedback({
        tone: error.type === "already-registered" ? "info" : "error",
        message: registrationErrorMessage(error, volunteerStatus),
      })
    } catch {
      setFeedback({ tone: "error", message: GENERIC_ERROR })
    } finally {
      setBusy(null)
    }
  }

  async function cancel() {
    if (!registration) return
    setBusy("cancel")
    setFeedback(null)
    try {
      const result = await cancelRegistrationAction(registration.id)
      if (result.ok) {
        setRegistration({ ...registration, status: "cancelled" })
        setFeedback({ tone: "info", message: "Your registration was cancelled." })
        router.refresh()
      } else {
        setFeedback({ tone: "error", message: cancellationErrorMessage(result.error) })
      }
    } catch {
      setFeedback({ tone: "error", message: GENERIC_ERROR })
    } finally {
      setBusy(null)
    }
  }

  function onRegisterClick() {
    if (step === "details" && questions.length > 0 && !returning) {
      setFeedback(null)
      setStep("questions")
      return
    }
    void submitRegistration()
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-4 sm:p-6 md:grid-cols-[2fr_3fr]">
        <section className="flex flex-col gap-3">
          {event.category && <p className="text-caption-md text-brand">{event.category}</p>}
          <Title className="text-header-lg">{event.title}</Title>
          {event.description && (
            <p className="text-body-sm whitespace-pre-line text-muted-foreground">{event.description}</p>
          )}
        </section>

        <section className="flex flex-col gap-5 rounded-xl border bg-card p-4 sm:p-5">
          {step === "details" ? (
            <>
              <h3 className="text-header-sm">Event Details</h3>
              <DetailRow icon={<CalendarIcon />} label="Date">
                <span className="text-foreground">{formatEventDay(event)}</span>{" "}
                <span>{formatEventTimeRange(event)}</span>
              </DetailRow>
              <DetailRow icon={<MapPinIcon />} label="Location">
                {event.location ?? "Location to be announced"}
              </DetailRow>
              {event.requirements && (
                <div className="flex flex-col gap-1">
                  <h4 className="text-body-sm text-muted-foreground">Requirements</h4>
                  <p className="text-body-sm whitespace-pre-line">{event.requirements}</p>
                </div>
              )}
            </>
          ) : (
            <form
              className="flex flex-col gap-5"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void submitRegistration()
              }}
            >
              <h3 className="text-header-sm">Registration</h3>
              <RegistrationQuestions
                questions={questions}
                values={values}
                errors={fieldErrors}
                disabled={busy !== null}
                onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
              />
            </form>
          )}
        </section>
      </div>

      {blockedReason && (
        <div className="px-4 pb-4 sm:px-6">
          <FeedbackAlert feedback={{ tone: "info", message: blockedReason }} />
        </div>
      )}
      {/* Always mounted so screen readers announce each new message. */}
      <div aria-live="polite" aria-atomic="true" className={cn(feedback && "px-4 pb-4 sm:px-6")}>
        {feedback && <FeedbackAlert feedback={feedback} />}
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/50 p-4">
        <EventStatusChip chip={chip} />
        {eventOver ? null : registered ? (
          <Button
            size="lg"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy !== null}
            onClick={() => void cancel()}
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel registration"}
          </Button>
        ) : (
          <>
            {step === "questions" && (
              <Button variant="outline" size="lg" disabled={busy !== null} onClick={() => setStep("details")}>
                Back
              </Button>
            )}
            <Button
              size="lg"
              disabled={!canRegister || busy !== null}
              onClick={onRegisterClick}
            >
              {busy === "register"
                ? "Registering…"
                : state !== "open" && !registered
                  ? CLOSED_LABELS[state]
                  : "Register"}
              {busy === null && canRegister && <ArrowRightIcon aria-hidden data-icon="inline-end" />}
            </Button>
          </>
        )}
      </footer>
    </div>
  )
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info [&_svg]:size-5"
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="text-body-sm text-muted-foreground">{label}</p>
        <p className="text-body-md text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

const FEEDBACK_ICONS = { success: CircleCheckIcon, error: TriangleAlertIcon, info: InfoIcon }

function FeedbackAlert({ feedback }: { feedback: Feedback }) {
  const Icon = FEEDBACK_ICONS[feedback.tone]
  return (
    <Alert
      // The surrounding live region announces it; no nested role="alert".
      role={undefined}
      variant={feedback.tone === "error" ? "destructive" : "default"}
      className={cn(
        feedback.tone === "success" && "border-success-border bg-success-muted text-success",
        feedback.tone === "info" && "border-info-border bg-info-muted text-info"
      )}
    >
      <Icon aria-hidden />
      <AlertDescription className="text-current">{feedback.message}</AlertDescription>
    </Alert>
  )
}
