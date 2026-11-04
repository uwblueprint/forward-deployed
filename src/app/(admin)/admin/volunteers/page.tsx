import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminVolunteersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
        <p className="text-sm text-muted-foreground">
          Volunteer profiles, applications, and event assignments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No volunteers yet</CardTitle>
          <CardDescription>
            Placeholder page. The volunteer roster will render here once the
            volunteers feature is wired up to Supabase.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
