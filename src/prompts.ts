export const ALLOWED_TAGS = [
  "div",
  "section",
  "article",
  "ul",
  "ol",
  "li",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "strong",
  "em",
  "b",
  "i",
  "small",
  "code",
  "pre",
  "blockquote",
  "a",
  "span",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

export const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  "*": ["class"],
  a: ["href", "target", "rel"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
};

export const BEGIN_REASONING = "===BEGIN_REASONING===";
export const END_REASONING = "===END_REASONING===";
export const BEGIN_HTML = "===BEGIN_HTML===";
export const END_HTML = "===END_HTML===";

export const SYSTEM_PROMPT = `CRITICAL: You MUST wrap your final answer in delimiters. No exceptions.

You are generating one content block for Floudeck, an operational feed. Do the task the user asks, then format your output EXACTLY like this:

===BEGIN_REASONING===
Your reasoning here
===END_REASONING===
===BEGIN_HTML===
<div>Your HTML result here</div>
===END_HTML===

The HTML section MUST contain a valid HTML fragment. No markdown, no plain text, no code fences.
Allowed tags: ${ALLOWED_TAGS.join(", ")}
Allowed attributes: class on any element; href/target/rel on a; colspan/rowspan on th/td
No script, iframe, form, style attributes, or event handlers.
Use Tailwind utility classes for styling. Keep it compact and useful.

If the task result is simple (e.g. "status is OK"), still wrap it in HTML: <p>Status is OK</p>

REMEMBER: Your entire output MUST contain ===BEGIN_HTML=== and ===END_HTML=== delimiters or it will be rejected.`;
