import { describe, expect, test } from "bun:test";
import { extractHtmlFromOutput, sanitizeBlockHtml } from "./sanitize.ts";

describe("sanitizeBlockHtml", () => {
  test("allows safe tags", () => {
    const input = '<div class="test"><p>Hello <strong>world</strong></p></div>';
    expect(sanitizeBlockHtml(input)).toBe(input);
  });

  test("strips script tags", () => {
    expect(sanitizeBlockHtml("<script>alert(1)</script><p>ok</p>")).toBe(
      "<p>ok</p>",
    );
  });

  test("strips iframe tags", () => {
    expect(sanitizeBlockHtml('<iframe src="x"></iframe><p>ok</p>')).toBe(
      "<p>ok</p>",
    );
  });

  test("strips form tags", () => {
    expect(sanitizeBlockHtml("<form><input></form><p>ok</p>")).toBe(
      "<p>ok</p>",
    );
  });

  test("strips style attributes", () => {
    expect(sanitizeBlockHtml('<p style="color:red">text</p>')).toBe(
      "<p>text</p>",
    );
  });

  test("strips onclick attributes", () => {
    expect(sanitizeBlockHtml('<p onclick="alert(1)">text</p>')).toBe(
      "<p>text</p>",
    );
  });

  test("allows links with href, target, rel", () => {
    const input =
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>';
    expect(sanitizeBlockHtml(input)).toBe(input);
  });

  test("allows table elements", () => {
    const input =
      "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>";
    expect(sanitizeBlockHtml(input)).toBe(input);
  });
});

describe("extractHtmlFromOutput", () => {
  test("extracts HTML between delimiters", () => {
    const output = `some text
===BEGIN_HTML===
<div>hello</div>
===END_HTML===
trailing`;
    const result = extractHtmlFromOutput(output);
    expect(result.html).toBe("<div>hello</div>");
  });

  test("extracts reasoning", () => {
    const output = `===BEGIN_REASONING===
thinking here
===END_REASONING===
===BEGIN_HTML===
<p>result</p>
===END_HTML===`;
    const result = extractHtmlFromOutput(output);
    expect(result.reasoning).toBe("thinking here");
    expect(result.html).toBe("<p>result</p>");
  });

  test("returns null html when delimiters missing", () => {
    const result = extractHtmlFromOutput("no delimiters here");
    expect(result.html).toBeNull();
  });

  test("returns null html when section is empty", () => {
    const output = `===BEGIN_HTML===
===END_HTML===`;
    const result = extractHtmlFromOutput(output);
    expect(result.html).toBeNull();
  });

  test("returns null reasoning when not present", () => {
    const output = `===BEGIN_HTML===
<p>x</p>
===END_HTML===`;
    const result = extractHtmlFromOutput(output);
    expect(result.reasoning).toBeNull();
  });
});
