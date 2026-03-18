export type DateFormat =
  | "D. M. YYYY"
  | "YYYY-MM-DD"
  | "DD/MM/YYYY"
  | "MM/DD/YYYY";
export type TimeFormat = "24h" | "12h";

export function formatDate(date: Date, format: DateFormat): string {
  const d = date.getDate();
  const dd = String(d).padStart(2, "0");
  const m = date.getMonth() + 1;
  const mm = String(m).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  switch (format) {
    case "D. M. YYYY":
      return `${d}. ${m}. ${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    case "DD/MM/YYYY":
      return `${dd}/${mm}/${yyyy}`;
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
  }
}

export function formatTime(date: Date, format: TimeFormat): string {
  const h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, "0");
  if (format === "24h") {
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${h12}:${min} ${ampm}`;
}

export function formatSchedule(value: number, unit: string): string {
  if (value === 1) {
    const singular = unit.replace(/s$/, "");
    return `Every ${singular}`;
  }
  return `Every ${value} ${unit}`;
}

export function formatTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatTimeUntil(iso: string | null): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "due now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}
