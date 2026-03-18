type CalendarPopoverProps = {
  today: Date;
};

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function CalendarPopover({ today }: CalendarPopoverProps) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();

  // First day of month (0=Sun, convert to Mon-based: 0=Mon)
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: `day-${d}` });
  }

  const monthName = new Date(year, month).toLocaleString("en", {
    month: "long",
  });

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-center text-xs font-semibold text-zinc-700">
        {monthName} {year}
      </p>
      <div className="grid grid-cols-7 text-center text-xs">
        {DAY_LABELS.map((label) => (
          <div key={label} className="pb-1 font-medium text-zinc-400">
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const isToday = cell.day === todayDate;
          return (
            <div
              key={cell.key}
              className={`flex h-7 items-center justify-center rounded ${
                isToday
                  ? "bg-zinc-800 font-bold text-white"
                  : cell.day
                    ? "text-zinc-600"
                    : ""
              }`}
            >
              {cell.day ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
