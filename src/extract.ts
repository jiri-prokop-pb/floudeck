import { BEGIN_MARKDOWN, END_MARKDOWN } from "./prompts.ts";

export function extractMarkdownFromOutput(stdout: string): {
  markdown: string | null;
  reasoning: string | null;
} {
  const mdStart = stdout.indexOf(BEGIN_MARKDOWN);
  const mdEnd = stdout.indexOf(END_MARKDOWN);

  let markdown: string | null = null;
  if (mdStart !== -1 && mdEnd !== -1 && mdEnd > mdStart) {
    markdown = stdout.slice(mdStart + BEGIN_MARKDOWN.length, mdEnd).trim();
    if (markdown === "") markdown = null;
  }

  let reasoning: string | null = null;
  const reasonStart = stdout.indexOf("===BEGIN_REASONING===");
  const reasonEnd = stdout.indexOf("===END_REASONING===");
  if (reasonStart !== -1 && reasonEnd !== -1 && reasonEnd > reasonStart) {
    reasoning = stdout
      .slice(reasonStart + "===BEGIN_REASONING===".length, reasonEnd)
      .trim();
    if (reasoning === "") reasoning = null;
  }

  return { markdown, reasoning };
}
