const GENERATED_HEADER = [
  "<!-- Generated from /product-events. -->",
  "<!-- Do not edit directly. -->",
  "<!-- To change this file, add or modify product events. -->",
  "",
].join("\n");

export function toGeneratedMarkdown(content: string): string {
  return `${GENERATED_HEADER}${content.trimEnd()}\n`;
}
