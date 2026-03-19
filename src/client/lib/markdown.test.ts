import { describe, expect, test } from "bun:test";
import { extractTitle, renderMarkdown } from "./markdown.ts";

describe("renderMarkdown", () => {
  test("converts headings", () => {
    expect(renderMarkdown("## Hello")).toContain("<h2");
    expect(renderMarkdown("## Hello")).toContain("Hello");
  });

  test("converts lists", () => {
    const result = renderMarkdown("- item 1\n- item 2");
    expect(result).toContain("<ul");
    expect(result).toContain("<li");
  });

  test("converts tables", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const result = renderMarkdown(md);
    expect(result).toContain("<table");
    expect(result).toContain("<td");
  });

  test("converts code blocks", () => {
    const result = renderMarkdown("```js\nconsole.log('hi')\n```");
    expect(result).toContain("<code");
  });

  test("converts links", () => {
    const result = renderMarkdown("[click](https://example.com)");
    expect(result).toContain("<a");
    expect(result).toContain("https://example.com");
  });

  test("renders action links as colored pills", () => {
    const result = renderMarkdown(
      "[Run task|blue](/action/abc-123/run?mode=fast)",
    );
    expect(result).toContain("rounded-full");
    expect(result).toContain("bg-blue-100");
    expect(result).toContain("text-blue-700");
    expect(result).toContain('data-action-link="true"');
    expect(result).toContain("Run task");
    expect(result).not.toContain("|blue");
  });

  test("renders action links with default green color", () => {
    const result = renderMarkdown("[Do it](/action/abc-123/do)");
    expect(result).toContain("bg-green-100");
    expect(result).toContain("text-green-700");
  });

  test("renders action links with escaped pipe in table cells", () => {
    const md =
      "| Action |\n|---|\n| [Review\\|green](/action/abc-123/review) |";
    const result = renderMarkdown(md);
    expect(result).toContain("rounded-full");
    expect(result).toContain("bg-green-100");
    expect(result).toContain("Review");
    expect(result).not.toContain("|green");
  });

  test("renders regular links with color tag as colored text", () => {
    const result = renderMarkdown("[Open docs|blue](https://example.com/docs)");
    expect(result).toContain("text-blue-600");
    expect(result).toContain("underline");
    expect(result).toContain("Open docs");
    expect(result).not.toContain("|blue");
    expect(result).not.toContain("rounded-full");
    expect(result).toContain('target="_blank"');
  });

  test("renders regular links without color tag with target=_blank", () => {
    const result = renderMarkdown("[click](https://example.com)");
    expect(result).not.toContain("text-blue-600");
    expect(result).not.toContain("text-green-600");
    expect(result).toContain("click");
    expect(result).toContain("https://example.com");
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  test("strips raw HTML in markdown input", () => {
    const result = renderMarkdown("hello <script>alert(1)</script> world");
    expect(result).not.toContain("<script");
    expect(result).toContain("hello");
    expect(result).toContain("world");
  });
});

describe("extractTitle", () => {
  test("extracts H1 from first line", () => {
    const result = extractTitle("# My Title\n\nSome content");
    expect(result.title).toBe("My Title");
    expect(result.body).toBe("Some content");
  });

  test("finds H1 preceded by whitespace/blank lines", () => {
    const result = extractTitle("\n\n# Found It\n\nBody here");
    expect(result.title).toBe("Found It");
    expect(result.body).toBe("Body here");
  });

  test("handles missing H1 gracefully", () => {
    const result = extractTitle("Just some text\n\nNo heading here");
    expect(result.title).toBe("Untitled");
    expect(result.body).toBe("Just some text\n\nNo heading here");
  });

  test("removes the H1 line from the body", () => {
    const result = extractTitle("# Title\n\nParagraph 1\n\nParagraph 2");
    expect(result.body).toBe("Paragraph 1\n\nParagraph 2");
    expect(result.body).not.toContain("# Title");
  });

  test("does not match ## as H1", () => {
    const result = extractTitle("## Subtitle\n\nContent");
    expect(result.title).toBe("Untitled");
  });
});
