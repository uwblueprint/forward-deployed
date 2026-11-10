import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center sm:px-6">
      <Badge variant="secondary">Scaffold ready</Badge>
      <h1 className="text-3xl font-semibold tracking-tight">Forward Deployed</h1>
      <p className="max-w-lg text-muted-foreground">
        A Next.js App Router project wired up with Tailwind CSS and the shadcn/ui base
        primitives. Start building features in <code className="font-mono">src/features</code>.
      </p>

      <Card className="w-full text-left">
        <CardHeader>
          <CardDescription>Where to go next</CardDescription>
          <CardTitle className="text-base font-medium">
            See the README for the stack, project layout, and import rules.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" render={<Link href="/showcase">View installed UI primitives</Link>} />
        </CardContent>
      </Card>
    </div>
  )
}
