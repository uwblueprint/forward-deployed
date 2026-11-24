import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import type { ApplicationReview } from "../api/applicationReview"
import { ApplicationDecisionPanel } from "./ApplicationDecisionPanel"
import { ApplicationNoteCard } from "./ApplicationNoteCard"
import { ApplicationStatusBadge } from "./ApplicationStatusBadge"
import { formatAnswer, formatDate, fullName } from "./format"

export type ApplicationDetailProps = {
  application: ApplicationReview
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm whitespace-pre-wrap">{children || "—"}</dd>
    </div>
  )
}

/** One application for review: who applied, what they answered, and the decision controls. */
export function ApplicationDetail({ application }: ApplicationDetailProps) {
  const { volunteer } = application
  const name = fullName(volunteer.user) || volunteer.user?.email || "This applicant"
  const reviewer = fullName(application.reviewer)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/admin/applications" className="text-sm text-muted-foreground hover:text-foreground">
          ← All applications
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <ApplicationStatusBadge status={application.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Submitted {formatDate(application.submittedAt)}
          {application.reviewedAt &&
            ` · ${capitalize(application.status)} ${formatDate(application.reviewedAt)}${reviewer ? ` by ${reviewer}` : ""}`}
          {" · "}
          <Link href={`/admin/volunteers/${volunteer.id}`} className="underline underline-offset-4 hover:text-foreground">
            View profile
          </Link>
        </p>
      </div>

      {application.isLatest ? (
        <ApplicationDecisionPanel
          applicationId={application.id}
          applicantName={name}
          status={application.status}
          applicantMessage={application.applicantMessage}
          canWriteNote={application.canManageNote}
          hasNote={application.note !== null}
        />
      ) : (
        <Alert>
          <AlertTitle>This volunteer has applied again</AlertTitle>
          <AlertDescription>
            Only their latest application can be decided.{" "}
            {application.latestApplicationId && (
              <Link href={`/admin/applications/${application.latestApplicationId}`} className="underline underline-offset-4">
                Open the latest application
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {application.status === "rejected" && (
        <Card>
          <CardHeader>
            <CardTitle>Message to the volunteer</CardTitle>
            <CardDescription>Shown to the volunteer with their rejection.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">
              {application.applicantMessage ?? <span className="text-muted-foreground">No message.</span>}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <Detail label="Email">{volunteer.user?.email}</Detail>
              <Detail label="Phone">{volunteer.phone}</Detail>
              <Detail label="Location">{volunteer.location}</Detail>
              <Detail label="Availability">{volunteer.availability_days.map(capitalize).join(", ")}</Detail>
              <Detail label="Shift">{volunteer.shift_preference && capitalize(volunteer.shift_preference)}</Detail>
              <Detail label="Skills">{volunteer.skills.join(", ")}</Detail>
              <Detail label="Emergency contact">
                {[
                  volunteer.emergency_contact_name,
                  volunteer.emergency_contact_relationship && `(${volunteer.emergency_contact_relationship})`,
                  volunteer.emergency_contact_phone,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </Detail>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Answers</CardTitle>
            <CardDescription>The organization&apos;s questions as they were asked.</CardDescription>
          </CardHeader>
          <CardContent>
            {application.answers.length === 0 ? (
              <p className="text-sm text-muted-foreground">This application had no questions.</p>
            ) : (
              <dl className="flex flex-col gap-4">
                {application.answers.map((answer) => (
                  <div key={answer.questionId} className="flex flex-col gap-1">
                    <dt className="text-sm font-medium">{answer.question}</dt>
                    <dd
                      className={
                        answer.answer === null ? "text-sm text-muted-foreground" : "text-sm whitespace-pre-wrap"
                      }
                    >
                      {formatAnswer(answer.answer)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      {application.canManageNote && <ApplicationNoteCard applicationId={application.id} note={application.note} />}

      {application.otherApplications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other applications</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {application.otherApplications.map((other) => (
                <li key={other.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/admin/applications/${other.id}`} className="underline underline-offset-4">
                    Submitted {formatDate(other.submittedAt)}
                  </Link>
                  <ApplicationStatusBadge status={other.status} />
                  {other.applicantMessage && (
                    <span className="text-muted-foreground">“{other.applicantMessage}”</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
