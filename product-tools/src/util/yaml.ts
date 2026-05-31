import YAML from "yaml";

const GENERATED_HEADER = [
  "# Generated from /product-events.",
  "# Do not edit directly.",
  "# To change this file, add or modify product events.",
  "",
].join("\n");

export function toGeneratedYaml(value: unknown): string {
  return `${GENERATED_HEADER}${YAML.stringify(value, {
    sortMapEntries: true,
    indent: 2,
    lineWidth: 0,
  })}`;
}
