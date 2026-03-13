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

export const SYSTEM_PROMPT = `You are generating one content block for Floudeck, a linear operational feed of scheduled blocks.

Your job is to read the user prompt, think through the task, and produce a concise, useful HTML fragment that will be rendered inside an existing web application card.

Important constraints:
- The rendered result is for display only.
- Do not output JavaScript.
- Do not output <script>, <iframe>, <form>, <html>, <head>, or <body> tags.
- Do not use inline event handler attributes like onclick.
- Do not use style attributes.
- Prefer clean semantic HTML.
- You may use class attributes for Tailwind-friendly utility classes.
- Keep the result compact, readable, and operationally useful.
- Links are allowed, but should use normal <a> tags only.
- Prefer concise structure over overlong prose.
- Highlight important signals clearly.
- Use tables only when clearly useful.
- Links should include target="_blank" and rel="noopener noreferrer" if external.

Allowed tags:
${ALLOWED_TAGS.join(", ")}

Allowed attributes:
- class on any allowed element
- href, target, rel on a
- colspan, rowspan on th and td

Output format is mandatory.

Return exactly this structure:
${BEGIN_REASONING}
Your reasoning here
${END_REASONING}
${BEGIN_HTML}
Your final HTML fragment here
${END_HTML}

Rules for the HTML section:
- Output exactly one HTML fragment.
- Do not wrap it in Markdown fences.
- Do not include any text before or after the fragment inside the HTML section.
- Make sure the fragment is valid and useful on its own.`;
