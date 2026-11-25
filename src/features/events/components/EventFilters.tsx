"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { CalendarIcon, MapPinIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import type { EventFilterValues } from "../utils/eventFilters"
import { EMPTY_EVENT_FILTERS, eventFiltersHref, hasEventFilters } from "../utils/eventFilters"

const SEARCH_DEBOUNCE_MS = 300
const ALL_CATEGORIES = "__all__"

interface EventFiltersProps {
  values: EventFilterValues
  categories: string[]
  locations: string[]
}

const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

function dayLabel(day: string) {
  return shortDay.format(new Date(`${day}T00:00:00Z`))
}

function dateButtonLabel({ from, to }: EventFilterValues) {
  if (from && to) return `${dayLabel(from)} – ${dayLabel(to)}`
  if (from) return `From ${dayLabel(from)}`
  if (to) return `Until ${dayLabel(to)}`
  return "Date"
}

/**
 * Figma "Find Events" bar: name search, date, location, plus a category
 * select. Every filter lives in the URL, so the server page re-queries
 * getOpportunities and links stay shareable.
 */
export function EventFilters({ values, categories, locations }: EventFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  // The search box is local while typing; it follows the URL only when that
  // changes from elsewhere (back/forward, Clear filters) - not when one of our
  // own debounced searches lands, which would clobber anything typed since.
  // Every outstanding search is tracked, so a slow "a" landing after "ab" was
  // sent is still recognised as ours.
  const [query, setQuery] = useState(values.q)
  const [syncedQuery, setSyncedQuery] = useState(values.q)
  const [pushedQueries, setPushedQueries] = useState<string[]>([values.q])
  if (values.q !== syncedQuery) {
    setSyncedQuery(values.q)
    const index = pushedQueries.lastIndexOf(values.q)
    if (index === -1) {
      setQuery(values.q)
      setPushedQueries([values.q])
    } else {
      // Responses older than this one can no longer arrive in a way that matters.
      setPushedQueries(pushedQueries.slice(index))
    }
  }

  const [locationQuery, setLocationQuery] = useState("")
  const [locationOpen, setLocationOpen] = useState(false)

  // Filter changes made before the server's new props arrive. Each change
  // builds on the last one (not on stale props), so From-then-To keeps both.
  // Cleared once the props catch up to our latest URL, or move to a URL we
  // never pushed (back/forward).
  const [pendingNav, setPendingNav] = useState<{ values: EventFilterValues; hrefs: string[] } | null>(null)
  const [syncedValues, setSyncedValues] = useState(values)
  if (values !== syncedValues) {
    setSyncedValues(values)
    if (pendingNav) {
      const href = eventFiltersHref(pathname, values)
      const { hrefs } = pendingNav
      if (href === hrefs[hrefs.length - 1] || !hrefs.includes(href)) setPendingNav(null)
    }
  }
  const current = pendingNav?.values ?? values

  // For the debounce timer and back-to-back events, which can run before a re-render.
  const currentRef = useRef(current)
  useEffect(() => {
    currentRef.current = current
  })

  function apply(changes: Partial<EventFilterValues>) {
    const next = { ...currentRef.current, ...changes }
    const href = eventFiltersHref(pathname, next)
    currentRef.current = next
    setPendingNav((prev) => ({ values: next, hrefs: [...(prev?.hrefs ?? []), href] }))
    startTransition(() => {
      router.replace(href, { scroll: false })
    })
  }

  useEffect(() => {
    if (query.trim() === currentRef.current.q) return
    const timer = setTimeout(() => {
      setPushedQueries((prev) => [...prev, query.trim()])
      apply({ q: query.trim() })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // apply reads the latest values through currentRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const locationMatches = locations.filter((location) =>
    location.toLowerCase().includes(locationQuery.trim().toLowerCase())
  )

  function clearAll() {
    setQuery("")
    setPushedQueries((prev) => [...prev, ""])
    apply(EMPTY_EVENT_FILTERS)
  }

  function chooseLocation(location: string) {
    apply({ location })
    setLocationQuery("")
    setLocationOpen(false)
  }

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
        <InputGroup className="h-9 bg-background sm:w-80">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Search events by name"
            placeholder="Search events by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>

        <Popover>
          <PopoverTrigger render={<Button variant={current.from || current.to ? "default" : "outline"} size="lg" />}>
            <CalendarIcon aria-hidden data-icon="inline-start" />
            {dateButtonLabel(current)}
          </PopoverTrigger>
          <PopoverContent align="start" className="gap-3">
            <p className="text-header-sm">Filter by date</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-filter-from">From</Label>
              <Input
                id="event-filter-from"
                type="date"
                value={current.from}
                max={current.to || undefined}
                onChange={(e) => apply({ from: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-filter-to">To</Label>
              <Input
                id="event-filter-to"
                type="date"
                value={current.to}
                min={current.from || undefined}
                onChange={(e) => apply({ to: e.target.value })}
              />
            </div>
            {(current.from || current.to) && (
              <Button variant="ghost" size="sm" onClick={() => apply({ from: "", to: "" })}>
                Clear dates
              </Button>
            )}
          </PopoverContent>
        </Popover>

        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
          <PopoverTrigger render={<Button variant={current.location ? "default" : "outline"} size="lg" />}>
            <MapPinIcon aria-hidden data-icon="inline-start" />
            {current.location || "Location"}
          </PopoverTrigger>
          <PopoverContent align="start" className="gap-1 p-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (locationQuery.trim()) chooseLocation(locationQuery.trim())
              }}
            >
              <InputGroup className="h-9">
                <InputGroupAddon>
                  <SearchIcon aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Search locations"
                  placeholder="Search"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                />
              </InputGroup>
            </form>
            <ul className="flex max-h-60 flex-col overflow-y-auto">
              {locationMatches.map((location) => (
                <li key={location}>
                  <Button
                    variant="ghost"
                    className="h-8 w-full justify-start font-normal"
                    aria-pressed={current.location === location}
                    onClick={() => chooseLocation(location)}
                  >
                    {location}
                  </Button>
                </li>
              ))}
              {locationMatches.length === 0 && (
                <li className="px-2.5 py-1.5 text-caption-md text-muted-foreground">
                  {locationQuery.trim() ? "Press Enter to search this location" : "No locations yet"}
                </li>
              )}
            </ul>
            {current.location && (
              <Button variant="ghost" className="justify-start text-brand" onClick={() => chooseLocation("")}>
                <XIcon aria-hidden data-icon="inline-start" />
                Any location
              </Button>
            )}
          </PopoverContent>
        </Popover>

        <Select
          value={current.category || ALL_CATEGORIES}
          onValueChange={(value) => apply({ category: !value || value === ALL_CATEGORIES ? "" : String(value) })}
        >
          <SelectTrigger aria-label="Category" className="h-9 bg-background data-[size=default]:h-9">
            <SelectValue>
              {(value: string | null) => (!value || value === ALL_CATEGORIES ? "All categories" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasEventFilters(current) && (
        <Button variant="link" size="sm" className="self-center" onClick={clearAll}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
