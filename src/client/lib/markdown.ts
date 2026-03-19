import { Marked, Renderer } from "marked";

const ACTION_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-700 hover:bg-red-200",
  orange: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  yellow: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  green: "bg-green-100 text-green-700 hover:bg-green-200",
  blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  purple: "bg-purple-100 text-purple-700 hover:bg-purple-200",
};

const DEFAULT_ACTION_COLOR = "green";

function parseActionLabel(text: string): { label: string; color: string } {
  const pipeIdx = text.lastIndexOf("|");
  if (pipeIdx === -1) {
    return { label: text, color: DEFAULT_ACTION_COLOR };
  }
  const maybeColor = text
    .slice(pipeIdx + 1)
    .trim()
    .toLowerCase();
  if (maybeColor in ACTION_COLORS) {
    return { label: text.slice(0, pipeIdx).trim(), color: maybeColor };
  }
  return { label: text, color: DEFAULT_ACTION_COLOR };
}

const renderer = new Renderer();
renderer.html = () => "";

const marked = new Marked({
  gfm: true,
  renderer,
});

marked.use({
  renderer: {
    link(token) {
      const href = token.href;
      if (href.startsWith("/action/")) {
        const { label, color } = parseActionLabel(token.text);
        const classes =
          ACTION_COLORS[color] ?? ACTION_COLORS[DEFAULT_ACTION_COLOR];
        const escapedHref = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const escapedLabel = label
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<a href="${escapedHref}" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${classes} no-underline transition-colors cursor-pointer" data-action-link="true">${escapedLabel}</a>`;
      }
      return false;
    },
  },
});

export function renderMarkdown(md: string): string {
  const result = marked.parse(md);
  if (typeof result === "string") return result;
  return "";
}

export function extractTitle(md: string): { title: string; body: string } {
  const lines = md.split("\n");
  const h1Index = lines.findIndex((line) => /^# .+/.test(line.trim()));

  if (h1Index === -1) {
    return { title: "Untitled", body: md };
  }

  const title = lines[h1Index]?.trim().replace(/^# /, "") ?? "Untitled";
  const remaining = [...lines.slice(0, h1Index), ...lines.slice(h1Index + 1)];
  const body = remaining.join("\n").replace(/^\n+/, "");

  return { title, body };
}
