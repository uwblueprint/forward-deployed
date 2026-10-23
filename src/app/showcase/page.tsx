"use client"

import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const primitives = [
  { name: "button", kind: "Action", file: "src/components/ui/button.tsx" },
  { name: "input", kind: "Form", file: "src/components/ui/input.tsx" },
  { name: "label", kind: "Form", file: "src/components/ui/label.tsx" },
  { name: "card", kind: "Layout", file: "src/components/ui/card.tsx" },
  { name: "dialog", kind: "Overlay", file: "src/components/ui/dialog.tsx" },
  {
    name: "dropdown-menu",
    kind: "Overlay",
    file: "src/components/ui/dropdown-menu.tsx",
  },
  { name: "select", kind: "Form", file: "src/components/ui/select.tsx" },
  { name: "table", kind: "Data", file: "src/components/ui/table.tsx" },
  { name: "badge", kind: "Display", file: "src/components/ui/badge.tsx" },
  { name: "tabs", kind: "Navigation", file: "src/components/ui/tabs.tsx" },
]

const stack = [
  { label: "Framework", value: "Next.js App Router" },
  { label: "Language", value: "TypeScript" },
  { label: "Styling", value: "Tailwind CSS v4" },
  { label: "Components", value: "shadcn/ui" },
  { label: "Linting", value: "ESLint" },
  { label: "Import alias", value: "@/*" },
]

export default function Home() {
  const [environment, setEnvironment] = React.useState("local")
  const [projectName, setProjectName] = React.useState("")

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="w-fit">
            Scaffold ready
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            Forward Deployed
          </h1>
          <p className="max-w-xl text-muted-foreground">
            A Next.js App Router project wired up with Tailwind CSS and the
            shadcn/ui base primitives. Everything below renders from the
            components checked into{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
              src/components/ui
            </code>
            .
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" aria-label="Project menu">
                <MoreHorizontalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Project</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Run dev server</DropdownMenuItem>
            <DropdownMenuItem>Add a component</DropdownMenuItem>
            <DropdownMenuItem>Open documentation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Tabs defaultValue="overview" className="mt-10">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="primitives">Primitives</TabsTrigger>
          <TabsTrigger value="form">Form</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {stack.map((item) => (
              <Card key={item.label}>
                <CardHeader>
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle>{item.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="primitives" className="pt-6">
          <Card>
            <CardContent>
              <Table>
                <TableCaption>
                  Installed via{" "}
                  <code className="font-mono">npx shadcn@latest add</code>.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Source
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {primitives.map((primitive) => (
                    <TableRow key={primitive.name}>
                      <TableCell className="font-medium">
                        {primitive.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{primitive.kind}</Badge>
                      </TableCell>
                      <TableCell className="hidden font-mono text-muted-foreground sm:table-cell">
                        {primitive.file}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>New deployment</CardTitle>
              <CardDescription>
                A throwaway form that exercises the input, label, select, button
                and dialog primitives together.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  placeholder="forward-deployed"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="environment">Environment</Label>
                <Select
                  value={environment}
                  onValueChange={(value) => setEnvironment(value as string)}
                >
                  <SelectTrigger id="environment" className="w-full">
                    <SelectValue placeholder="Pick an environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="preview">Preview</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="ghost">Reset</Button>
              <Dialog>
                <DialogTrigger render={<Button>Review</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Review deployment</DialogTitle>
                    <DialogDescription>
                      Nothing is actually deployed — this dialog is here to
                      prove the overlay primitives work.
                    </DialogDescription>
                  </DialogHeader>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Project</dt>
                    <dd>{projectName || "forward-deployed"}</dd>
                    <dt className="text-muted-foreground">Environment</dt>
                    <dd className="capitalize">{environment}</dd>
                  </dl>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline">Close</Button>} />
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
