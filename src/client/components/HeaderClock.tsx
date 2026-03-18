import { useEffect, useState } from "react";
import type { DisplaySettings } from "../../types.ts";
import { formatDate, formatTime } from "../lib/format.ts";
import { CalendarPopover } from "./CalendarPopover.tsx";

type HeaderClockProps = {
  displaySettings: DisplaySettings;
};

export function HeaderClock({ displaySettings }: HeaderClockProps) {
  const [now, setNow] = useState(() => new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  const dateStr = formatDate(now, displaySettings.dateFormat ?? "D. M. YYYY");
  const timeStr = formatTime(now, displaySettings.timeFormat ?? "24h");

  return (
    <div className="flex items-center gap-2 text-sm tabular-nums text-zinc-500">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip, not interactive */}
      <div
        className="relative"
        onMouseEnter={() => setShowCalendar(true)}
        onMouseLeave={() => setShowCalendar(false)}
      >
        <span className="cursor-default">{dateStr}</span>
        {showCalendar && <CalendarPopover today={now} />}
      </div>
      <span>{timeStr}</span>
    </div>
  );
}
