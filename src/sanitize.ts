import sanitizeHtml from "sanitize-html";
import {
  ALLOWED_ATTRIBUTES,
  ALLOWED_TAGS,
  BEGIN_HTML,
  END_HTML,
} from "./prompts.ts";

export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: { ...ALLOWED_ATTRIBUTES },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

export function sanitizeBlockHtml(raw: string): string {
  return sanitizeHtml(raw, SANITIZE_OPTIONS);
}

export function extractHtmlFromOutput(stdout: string): {
  html: string | null;
  reasoning: string | null;
} {
  const htmlStart = stdout.indexOf(BEGIN_HTML);
  const htmlEnd = stdout.indexOf(END_HTML);

  let html: string | null = null;
  if (htmlStart !== -1 && htmlEnd !== -1 && htmlEnd > htmlStart) {
    html = stdout.slice(htmlStart + BEGIN_HTML.length, htmlEnd).trim();
    if (html === "") html = null;
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

  return { html, reasoning };
}
