import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminApplicationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Pending volunteer applications to review and approve.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No applications yet</CardTitle>
          <CardDescription>
            Placeholder page. The application review queue will render here once applications are wired up to Supabase.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
