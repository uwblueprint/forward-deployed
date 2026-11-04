import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminEventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground">
          Upcoming and past events, schedules, and volunteer shifts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No events yet</CardTitle>
          <CardDescription>
            Placeholder page. Scheduled events will render here once the events
            feature is wired up to Supabase.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
