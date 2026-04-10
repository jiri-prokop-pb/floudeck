export const BEGIN_REASONING = "===BEGIN_REASONING===";
export const END_REASONING = "===END_REASONING===";
export const BEGIN_MARKDOWN = "===BEGIN_MARKDOWN===";
export const END_MARKDOWN = "===END_MARKDOWN===";

const OUTPUT_FORMAT = `Format your output EXACTLY like this:

===BEGIN_REASONING===
Your reasoning here
===END_REASONING===
===BEGIN_MARKDOWN===
# Title

Your markdown content here
===END_MARKDOWN===`;

const ACTION_LINKS = `You may include action links in your markdown output. Action links are special links that trigger interactive actions when clicked. Format:

[Label](/action/{block-uuid}/{action-name}?optional=query&params)

With optional color tag (pipe-separated before closing bracket):

[Label|red](/action/{block-uuid}/{action-name}?optional=query&params)

Color palette: red, orange, yellow, green, blue, purple. Default (no tag): green.
IMPORTANT: Inside markdown tables, escape the pipe as \\| so it is not parsed as a cell delimiter: [Label\\|green](/action/...)
Your block UUID is provided in the context. Use it when constructing action links.`;

export const SYSTEM_PROMPT = `CRITICAL: You MUST wrap your final answer in delimiters. No exceptions.

You are generating one content block for Floudeck, an operational feed. Do the task the user asks, then output your result.

${OUTPUT_FORMAT}

The markdown section MUST contain valid GitHub Flavored Markdown (GFM).
The FIRST line of the markdown section MUST be a level-1 heading (# Title) that describes what the content is about. This heading will be used as the card title.

You can use all GFM features:
- Headings (##, ###, etc. for subsections)
- Bold, italic, strikethrough
- Ordered and unordered lists
- Tables
- Code blocks with syntax highlighting
- Links
- Task lists (- [ ] / - [x])
- Blockquotes

Do NOT include raw HTML in the markdown section.
Keep it compact, readable, and operationally useful.

If the task result is simple (e.g. "status is OK"), still format it properly:
# Status Check

Status is **OK**.

REMEMBER: Your entire output MUST contain ===BEGIN_MARKDOWN=== and ===END_MARKDOWN=== delimiters or it will be rejected.

${ACTION_LINKS}

Color guidance: red = destructive/dangerous, orange = caution, green = safe/constructive, blue = informational/navigation, purple = advanced/settings.
The color tag syntax also works on regular links: [Open docs|blue](https://example.com) renders as colored underlined text. Action links render as colored pills.`;

export const TRY_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

If you encounter a permission error or cannot use a tool, explain what tool you tried to use and what went wrong in your reasoning section.`;

export const ACTION_SYSTEM_PROMPT = `CRITICAL: You MUST wrap your final answer in delimiters. No exceptions.

You are executing a custom action for a Floudeck block. The block's current output and the action details are provided below. Perform the requested action and return your result.

${OUTPUT_FORMAT}

The markdown section MUST contain valid GitHub Flavored Markdown (GFM).
The FIRST line of the markdown section MUST be a level-1 heading (# Title).
Keep it compact, readable, and actionable.
Do NOT include raw HTML in the markdown section.

REMEMBER: Your entire output MUST contain ===BEGIN_MARKDOWN=== and ===END_MARKDOWN=== delimiters or it will be rejected.

${ACTION_LINKS}`;

export function composeActionPrompt(
  blockOutputMarkdown: string,
  actionName: string,
  params: Record<string, string>,
  blockUuid: string,
): string {
  const paramLines = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  return `--- Block Context ---
${blockOutputMarkdown}

--- Action ---
Action: ${actionName}${paramLines ? `\nParameters:\n${paramLines}` : ""}

[Block UUID: ${blockUuid}]`;
}
