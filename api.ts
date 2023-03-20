import {
  type Span,
  SpanKind,
  context,
  trace,
} from "@opentelemetry/api";
import { Meteor } from "meteor/meteor";

const tracer = trace.getTracer('async_func');

export async function traceAsyncFunc<T>(spanName: string, func: (span: Span) => Promise<T>) {
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.INTERNAL,
  });
  try {
    const spanContext = trace.setSpan(context.active(), span);
    return await context.with(spanContext, () => func(span));
  } catch (err) {
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
}

export async function tracedInterval<T>(func: (span: Span) => Promise<T>, delayMs: number) {
  return Meteor.setInterval(() => traceAsyncFunc(func.name || '(anonymous)', func), delayMs);
}

export async function tracedTimeout<T>(func: (span: Span) => Promise<T>, delayMs: number) {
  return Meteor.setTimeout(() => traceAsyncFunc(func.name || '(anonymous)', func), delayMs);
}
