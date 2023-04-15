import {
  type Span,
} from "@opentelemetry/api";

declare module "meteor/danopia:opentelemetry" {

  export function traceAsyncFunc<T>(spanName: string, func: (span: Span) => Promise<T>): Promise<T>;

  export function tracedInterval<T>(func: (span: Span) => Promise<T>, delayMs: number): number;

  export function tracedTimeout<T>(func: (span: Span) => Promise<T>, delayMs: number): number;

}
