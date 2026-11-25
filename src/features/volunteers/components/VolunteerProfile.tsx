"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import type { VolunteerDetails } from "../api/volunteerDetails"
import { SHIFTS, WEEKDAYS } from "../schemas/volunteerSchema"
import { UserNameForm } from "./UserNameForm"
import { VolunteerProfileForm, type VolunteerProfileFormValues } from "./VolunteerProfileForm"

export type VolunteerProfileProps = {
  details: VolunteerDetails
  /** Admins rename anyone in their organization; managers can't. */
  canRename: boolean
}

// A fixed zone and locale so server and client render the same text. The
// organization is in Waterloo; change this if a deployment serves elsewhere.
const TIME_ZONE = "America/Toronto"
const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: TIME_ZONE })
const hoursFormat = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 })

const STATUS_VARIANT = { approved: "default", pending: "secondary", rejected: "destructive" } as const
const REGISTRATION_LABEL = { registered: "Registered", cancelled: "Cancelled" } as const
const ATTENDANCE_LABEL = { attended: "Attended", no_show: "No-show" } as const

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(iso: string) {
  return dateFormat.format(new Date(iso))
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || "—"}</dd>
    </div>
  )
}

function formValues({ volunteer }: VolunteerDetails): VolunteerProfileFormValues {
  const shift = SHIFTS.find((value) => value === volunteer.shift_preference)
  return {
    phone: volunteer.phone ?? "",
    location: volunteer.location ?? "",
    weekdays: WEEKDAYS.filter((day) => volunteer.availability_days.includes(day)),
    shiftPreference: shift ?? "",
    skills: volunteer.skills,
    emergencyContactName: volunteer.emergency_contact_name ?? "",
    emergencyContactPhone: volunteer.emergency_contact_phone ?? "",
    emergencyContactRelationship: volunteer.emergency_contact_relationship ?? "",
  }
}

/** Staff view of one volunteer: profile, latest application, and event history. */
export function VolunteerProfile({ details, canRename }: VolunteerProfileProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const { volunteer, user, latestApplication, events, eventsAttended, hours } = details
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unnamed volunteer"

  const [refreshing, startRefresh] = useTransition()

  // Edit and Rename stay disabled until the saved values arrive, so a form
  // reopened straight away can't start from the old ones and write them back.
  function saved(close: () => void) {
    close()
    startRefresh(() => router.refresh())
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/volunteers" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volunteers
        </Link>
        {renaming && user ? (
          <UserNameForm
            userId={user.id}
            initialValues={{ firstName: user.first_name ?? "", lastName: user.last_name ?? "" }}
            onSaved={() => saved(() => setRenaming(false))}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <Badge variant={STATUS_VARIANT[volunteer.status]}>{capitalize(volunteer.status)}</Badge>
            {canRename && user && (
              <Button variant="outline" size="sm" disabled={refreshing} onClick={() => setRenaming(true)}>
                Rename
              </Button>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{user?.email ?? "No email on file"}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          {!editing && (
            <CardAction>
              <Button variant="outline" size="sm" disabled={refreshing} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <VolunteerProfileForm
              volunteerId={volunteer.id}
              initialValues={formValues(details)}
              skillOptions={details.skillOptions}
              onSaved={() => saved(() => setEditing(false))}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Phone">{volunteer.phone}</Detail>
              <Detail label="Location">{volunteer.location}</Detail>
              <Detail label="Available days">
                {WEEKDAYS.filter((day) => volunteer.availability_days.includes(day))
                  .map((day) => capitalize(day.slice(0, 3)))
                  .join(", ")}
              </Detail>
              <Detail label="Shift preference">
                {volunteer.shift_preference && capitalize(volunteer.shift_preference)}
              </Detail>
              <Detail label="Skills">{volunteer.skills.join(", ")}</Detail>
              <Detail label="Emergency contact">
                {[
                  volunteer.emergency_contact_name,
                  volunteer.emergency_contact_relationship && `(${volunteer.emergency_contact_relationship})`,
                  volunteer.emergency_contact_phone && `· ${volunteer.emergency_contact_phone}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </Detail>
              <Detail label="Joined">{formatDate(volunteer.created_at)}</Detail>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest application</CardTitle>
          {latestApplication && (
            <CardAction>
              <Link
                href={`/admin/applications/${latestApplication.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open application
              </Link>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {latestApplication ? (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Status">
                <Badge variant={STATUS_VARIANT[latestApplication.status]}>
                  {capitalize(latestApplication.status)}
                </Badge>
              </Detail>
              <Detail label="Submitted">{formatDate(latestApplication.submittedAt)}</Detail>
              <Detail label="Reviewed">
                {latestApplication.reviewedAt && formatDate(latestApplication.reviewedAt)}
              </Detail>
              {latestApplication.applicantMessage && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Detail label="Message to the volunteer">{latestApplication.applicantMessage}</Detail>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No application yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event history</CardTitle>
          <CardDescription>
            {eventsAttended} {eventsAttended === 1 ? "event" : "events"} attended · {hoursFormat.format(hours)}{" "}
            {hoursFormat.format(hours) === "1" ? "hour" : "hours"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No event signups yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Signup</TableHead>
                  <TableHead>Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((item) => (
                  <TableRow key={item.registrationId}>
                    <TableCell>
                      {item.event.title}
                      {item.event.status === "cancelled" && (
                        <span className="text-muted-foreground"> (event cancelled)</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(item.event.starts_at)}</TableCell>
                    <TableCell>{REGISTRATION_LABEL[item.registrationStatus]}</TableCell>
                    <TableCell>{item.attendance ? ATTENDANCE_LABEL[item.attendance] : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
