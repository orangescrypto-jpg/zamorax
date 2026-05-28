"use client"

import {AdminService, where, query} from "@/src/services"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, CalendarDays, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface RentalCalendarProps {
  listingId: string
  maxRentalDays?: number
  onRangeSelect?: (start: Date, end: Date, days: number) => void
}

interface BookedRange {
  start: Date
  end: Date
}

export function RentalCalendar({ listingId, maxRentalDays = 30, onRangeSelect }: RentalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([])
  const [selectStart, setSelectStart] = useState<Date | null>(null)
  const [selectEnd, setSelectEnd] = useState<Date | null>(null)
  const [hovered, setHovered] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBookings() {
      setLoading(true)
      try {
        const q = await AdminService.getCollection("orders", [where("listingId", "==", listingId]),
          where("listingType", "==", "rent"),
          where("status", "in", ["paid", "active", "delivered", "inspecting"])
        )
        const snap = await AdminService.getCollection(q)
        const ranges: BookedRange[] = docs.map(d => ({
          start: d.rentalStartDate?.toDate() || new Date(),
          end: d.rentalEndDate?.toDate() || new Date() }))
        setBookedRanges(ranges)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchBookings()
  }, [listingId])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const startPad = startOfMonth.getDay()

  const days: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: endOfMonth.getDate() }, (_, i) =>
      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1)
    ),
  ]

  const isBooked = (date: Date) =>
    bookedRanges.some(r => date >= r.start && date <= r.end)

  const isPast = (date: Date) => date < today

  const isDisabled = (date: Date) => isPast(date) || isBooked(date)

  const isSelected = (date: Date) => {
    if (!selectStart) return false
    const end = selectEnd || hovered
    if (!end) return date.getTime() === selectStart.getTime()
    const lo = selectStart < end ? selectStart : end
    const hi = selectStart < end ? end : selectStart
    return date >= lo && date <= hi
  }

  const isRangeStart = (date: Date) => selectStart?.getTime() === date.getTime()
  const isRangeEnd = (date: Date) => selectEnd?.getTime() === date.getTime()

  const handleDayClick = (date: Date) => {
    if (isDisabled(date)) return
    if (!selectStart || selectEnd) {
      setSelectStart(date)
      setSelectEnd(null)
    } else {
      if (date < selectStart) {
        setSelectStart(date)
        setSelectEnd(null)
        return
      }
      const days = Math.round((date.getTime() - selectStart.getTime()) / 86400000) + 1
      if (days > maxRentalDays) return
      setSelectEnd(date)
      onRangeSelect?.(selectStart, date, days)
    }
  }

  const selectedDays = selectStart && selectEnd
    ? Math.round((selectEnd.getTime() - selectStart.getTime()) / 86400000) + 1
    : null

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))

  return (
    <div className="border rounded-xl bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Rental Availability</span>
        </div>
        {selectedDays && (
          <Badge variant="secondary" className="text-xs">
            {selectedDays} day{selectedDays > 1 ? "s" : ""} selected
          </Badge>
        )}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {currentMonth.toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
          <div key={d} className="text-xs text-muted-foreground py-1 font-medium">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
          Loading availability...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((date, i) => {
            if (!date) return <div key={`pad-${i}`} />
            const disabled = isDisabled(date)
            const booked = isBooked(date)
            const selected = isSelected(date)
            const start = isRangeStart(date)
            const end = isRangeEnd(date)

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDayClick(date)}
                onMouseEnter={() => !selectEnd && setHovered(date)}
                onMouseLeave={() => setHovered(null)}
                disabled={disabled}
                className={cn(
                  "text-xs py-1.5 rounded transition-colors relative",
                  disabled && "text-muted-foreground/40 cursor-not-allowed line-through",
                  booked && !disabled && "bg-destructive/10 text-destructive cursor-not-allowed",
                  !disabled && !selected && "hover:bg-accent/30 cursor-pointer",
                  selected && "bg-primary/20 text-primary",
                  (start || end) && "bg-primary text-primary-foreground font-bold rounded-full"
                )}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary/20 inline-block" /> Selected</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive/20 inline-block" /> Booked</span>
        <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Max {maxRentalDays} days</span>
      </div>

      {selectStart && !selectEnd && (
        <p className="text-xs text-muted-foreground text-center">Now select your return date</p>
      )}
    </div>
  )
}
