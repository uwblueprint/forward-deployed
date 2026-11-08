import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Organization and account settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nothing to configure yet</CardTitle>
          <CardDescription>
            Placeholder page. Admin settings will render here once there is something to change.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
