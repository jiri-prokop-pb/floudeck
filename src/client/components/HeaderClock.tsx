import { useEffect, useState } from "react";
import type { DisplaySettings } from "../../types.ts";
import { formatDate, formatTime } from "../lib/format.ts";
import { CalendarPopover } from "./CalendarPopover.tsx";

type HeaderClockProps = {
  displaySettings: DisplaySettings;
  compact?: boolean;
};

export function HeaderClock({ displaySettings, compact }: HeaderClockProps) {
  const [now, setNow] = useState(() => new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  const dateStr = formatDate(now, displaySettings.dateFormat ?? "D. M.");
  const timeStr = formatTime(now, displaySettings.timeFormat ?? "24h");

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip, not interactive
    <div
      className={`relative flex cursor-default items-center gap-2 tabular-nums text-zinc-500 ${compact ? "text-xs" : "text-sm"}`}
      onMouseEnter={() => setShowCalendar(true)}
      onMouseLeave={() => setShowCalendar(false)}
    >
      <span>{dateStr}</span>
      <span>{timeStr}</span>
      {showCalendar && <CalendarPopover today={now} />}
    </div>
  );
}
