import type { LoadedEvent } from "../validation/types.js";

export function nextEntityId(prefix: "PROD" | "CAP" | "FEAT" | "REQ" | "AC" | "TEST", existingIds: string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const numericParts = existingIds
    .map((id) => pattern.exec(id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => Number.parseInt(value, 10));

  const maxValue = numericParts.length > 0 ? Math.max(...numericParts) : 0;
  const width = Math.max(3, ...numericParts.map((value) => String(value).length));
  return `${prefix}-${String(maxValue + 1).padStart(width, "0")}`;
}

export function nextEventId(existingEvents: LoadedEvent[], occurredAt: string, reservedEventIds: string[] = []): string {
  const dateToken = occurredAt.slice(0, 10).replaceAll("-", "");
  const pattern = new RegExp(`^EVT-${dateToken}-(\\d+)$`);
  const numericParts = [...existingEvents.map(({ event }) => event.id), ...reservedEventIds]
    .map((id) => pattern.exec(id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => Number.parseInt(value, 10));

  const maxValue = numericParts.length > 0 ? Math.max(...numericParts) : 0;
  const width = Math.max(4, ...numericParts.map((value) => String(value).length));
  return `EVT-${dateToken}-${String(maxValue + 1).padStart(width, "0")}`;
}
