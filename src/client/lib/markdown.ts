import { Marked, Renderer } from "marked";

const renderer = new Renderer();
renderer.html = () => "";

const marked = new Marked({
  gfm: true,
  renderer,
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
