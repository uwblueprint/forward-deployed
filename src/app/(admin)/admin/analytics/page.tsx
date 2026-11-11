import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminAnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Reporting on events and volunteer activity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No reports yet</CardTitle>
          <CardDescription>
            Placeholder page. Event and volunteer analytics will render here once reporting is built.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
