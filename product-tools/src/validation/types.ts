import type { ProductEvent } from "../schemas/events.js";

export type ValidationError = {
  path: string;
  message: string;
};

export type LoadedEvent = {
  path: string;
  event: ProductEvent;
};

export type ValidationResult = {
  events: LoadedEvent[];
  errors: ValidationError[];
};
