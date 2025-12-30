"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Clock, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CalendarEvent = {
    id: string;
    title: string;
    start: Date;
    end: Date;
    status?: "upcoming" | "ongoing" | "completed" | "cancelled";
    course?: string;
    onClick?: () => void;
};

type CalendarViewProps = {
    events: CalendarEvent[];
    onDateClick?: (date: Date) => void;
    onEventClick?: (event: CalendarEvent) => void;
    className?: string;
};

type ViewMode = "month" | "week" | "day";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

function getStatusColor(status?: string) {
    switch (status) {
        case "upcoming":
            return "bg-blue-500 hover:bg-blue-600 text-white border-blue-600";
        case "ongoing":
            return "bg-amber-500 hover:bg-amber-600 text-white border-amber-600";
        case "completed":
            return "bg-green-500 hover:bg-green-600 text-white border-green-600";
        case "cancelled":
            return "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive";
        default:
            return "bg-primary hover:bg-primary/90 text-primary-foreground border-primary";
    }
}

function isSameDay(date1: Date, date2: Date) {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

function isToday(date: Date) {
    return isSameDay(date, new Date());
}

function getMonthDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const prevMonthDay = new Date(year, month, -(startingDayOfWeek - i - 1));
        days.push(prevMonthDay);
    }

    // Add all days in the month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }

    // Add empty cells to complete the last week
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
        for (let i = 1; i <= remainingDays; i++) {
            days.push(new Date(year, month + 1, i));
        }
    }

    return days;
}

function getWeekDays(date: Date) {
    const day = date.getDay();
    const diff = date.getDate() - day; // Start of week (Sunday)
    const weekStart = new Date(date);
    weekStart.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        days.push(d);
    }

    return days;
}

function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CalendarView({ events, onDateClick, onEventClick, className }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = React.useState(new Date());
    const [viewMode, setViewMode] = React.useState<ViewMode>("month");

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const goToPrevious = () => {
        const newDate = new Date(currentDate);
        if (viewMode === "month") {
            newDate.setMonth(currentMonth - 1);
        } else if (viewMode === "week") {
            newDate.setDate(currentDate.getDate() - 7);
        } else {
            newDate.setDate(currentDate.getDate() - 1);
        }
        setCurrentDate(newDate);
    };

    const goToNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === "month") {
            newDate.setMonth(currentMonth + 1);
        } else if (viewMode === "week") {
            newDate.setDate(currentDate.getDate() + 7);
        } else {
            newDate.setDate(currentDate.getDate() + 1);
        }
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const getEventsForDate = (date: Date) => {
        return events.filter(event => {
            const eventStart = new Date(event.start);
            return isSameDay(eventStart, date);
        }).sort((a, b) => a.start.getTime() - b.start.getTime());
    };

    const handleDateClick = (date: Date) => {
        onDateClick?.(date);
    };

    const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        onEventClick?.(event);
    };

    const renderMonthView = () => {
        const days = getMonthDays(currentYear, currentMonth);

        return (
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {/* Day headers */}
                {DAYS.map((day) => (
                    <div
                        key={day}
                        className="bg-muted px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                        {day}
                    </div>
                ))}

                {/* Calendar days */}
                {days.map((date, index) => {
                    if (!date) return null;

                    const dayEvents = getEventsForDate(date);
                    const isCurrentMonth = date.getMonth() === currentMonth;
                    const isTodayDate = isToday(date);

                    return (
                        <div
                            key={index}
                            onClick={() => handleDateClick(date)}
                            className={cn(
                                "bg-card min-h-[120px] p-2 cursor-pointer transition-colors hover:bg-accent/50",
                                !isCurrentMonth && "bg-muted/30",
                                isTodayDate && "bg-accent/10"
                            )}
                        >
                            <div className="flex items-center justify-center mb-1">
                                <span
                                    className={cn(
                                        "text-sm font-medium flex items-center justify-center w-7 h-7 rounded-full",
                                        !isCurrentMonth && "text-muted-foreground",
                                        isTodayDate && "bg-primary text-primary-foreground font-semibold"
                                    )}
                                >
                                    {date.getDate()}
                                </span>
                            </div>

                            <div className="space-y-1">
                                {dayEvents.slice(0, 3).map((event) => (
                                    <button
                                        key={event.id}
                                        onClick={(e) => handleEventClick(event, e)}
                                        className={cn(
                                            "w-full text-left px-1.5 py-0.5 rounded text-xs font-medium transition-all truncate border",
                                            getStatusColor(event.status)
                                        )}
                                        title={event.title}
                                    >
                                        <div className="flex items-center gap-1">
                                            <Clock className="size-2.5 flex-shrink-0" />
                                            <span className="truncate">{event.title}</span>
                                        </div>
                                    </button>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs text-muted-foreground font-medium px-1.5">
                                        +{dayEvents.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderWeekView = () => {
        const weekDays = getWeekDays(currentDate);
        const hours = Array.from({ length: 24 }, (_, i) => i);

        return (
            <div className="border rounded-lg overflow-hidden">
                {/* Week header */}
                <div className="grid grid-cols-8 gap-px bg-border">
                    <div className="bg-muted p-3"></div>
                    {weekDays.map((date, index) => {
                        const isTodayDate = isToday(date);
                        return (
                            <div
                                key={index}
                                className={cn(
                                    "bg-card p-3 text-center",
                                    isTodayDate && "bg-accent/10"
                                )}
                            >
                                <div className="text-xs font-semibold text-muted-foreground uppercase">
                                    {DAYS[date.getDay()]}
                                </div>
                                <div
                                    className={cn(
                                        "text-lg font-semibold mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full",
                                        isTodayDate && "bg-primary text-primary-foreground"
                                    )}
                                >
                                    {date.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Time grid */}
                <div className="max-h-[600px] overflow-y-auto">
                    <div className="grid grid-cols-8 gap-px bg-border">
                        {hours.map((hour) => (
                            <React.Fragment key={hour}>
                                <div className="bg-muted p-2 text-xs text-muted-foreground text-right border-r">
                                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                                </div>
                                {weekDays.map((date, dayIndex) => {
                                    const dayEvents = getEventsForDate(date).filter(event => {
                                        const eventHour = event.start.getHours();
                                        return eventHour === hour;
                                    });

                                    return (
                                        <div
                                            key={dayIndex}
                                            onClick={() => handleDateClick(date)}
                                            className="bg-card p-1 min-h-[60px] cursor-pointer hover:bg-accent/50 transition-colors relative"
                                        >
                                            {dayEvents.map((event) => (
                                                <button
                                                    key={event.id}
                                                    onClick={(e) => handleEventClick(event, e)}
                                                    className={cn(
                                                        "w-full text-left px-2 py-1 rounded text-xs font-medium mb-1 border",
                                                        getStatusColor(event.status)
                                                    )}
                                                >
                                                    <div className="font-semibold truncate">{event.title}</div>
                                                    <div className="text-[10px] opacity-90">{formatTime(event.start)}</div>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderDayView = () => {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const dayEvents = getEventsForDate(currentDate);

        return (
            <div className="border rounded-lg overflow-hidden">
                {/* Day header */}
                <div className="bg-muted p-4 border-b">
                    <div className="text-center">
                        <div className="text-sm font-semibold text-muted-foreground uppercase">
                            {DAYS[currentDate.getDay()]}
                        </div>
                        <div className="text-2xl font-bold mt-1">
                            {currentDate.getDate()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </div>
                    </div>
                </div>

                {/* Time slots */}
                <div className="max-h-[600px] overflow-y-auto">
                    {hours.map((hour) => {
                        const hourEvents = dayEvents.filter(event => {
                            const eventHour = event.start.getHours();
                            return eventHour === hour;
                        });

                        return (
                            <div key={hour} className="flex border-b">
                                <div className="w-20 bg-muted p-3 text-xs text-muted-foreground text-right border-r flex-shrink-0">
                                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                                </div>
                                <div className="flex-1 p-2 min-h-[80px] bg-card space-y-2">
                                    {hourEvents.map((event) => (
                                        <button
                                            key={event.id}
                                            onClick={(e) => handleEventClick(event, e)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded border",
                                                getStatusColor(event.status)
                                            )}
                                        >
                                            <div className="font-semibold">{event.title}</div>
                                            <div className="text-xs opacity-90 mt-1">
                                                {formatTime(event.start)} - {formatTime(event.end)}
                                            </div>
                                            {event.course && (
                                                <div className="text-xs opacity-80 mt-1">{event.course}</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <Card className={className}>
            <CardContent className="p-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={goToPrevious}
                            className="h-9 w-9"
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={goToToday}
                            className="h-9 gap-1.5"
                        >
                            <CalendarDays className="size-4" />
                            Today
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={goToNext}
                            className="h-9 w-9"
                        >
                            <ChevronRight className="size-4" />
                        </Button>

                    </div>

                    <h2 className="text-xl font-semibold">
                        {viewMode === "day"
                            ? `${MONTHS[currentMonth]} ${currentDate.getDate()}, ${currentYear}`
                            : `${MONTHS[currentMonth]} ${currentYear}`
                        }
                    </h2>

                    <div className="flex items-center gap-2">
                        <Button
                            variant={viewMode === "month" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("month")}
                            className="h-9"
                        >
                            Month
                        </Button>
                        <Button
                            variant={viewMode === "week" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("week")}
                            className="h-9"
                        >
                            Week
                        </Button>
                        <Button
                            variant={viewMode === "day" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("day")}
                            className="h-9"
                        >
                            Day
                        </Button>
                    </div>
                </div>

                {/* Calendar views */}
                {viewMode === "month" && renderMonthView()}
                {viewMode === "week" && renderWeekView()}
                {viewMode === "day" && renderDayView()}
            </CardContent>
        </Card>
    );
}
