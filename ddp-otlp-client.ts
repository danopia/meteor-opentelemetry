import { Meteor } from "meteor/meteor";

import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-web';
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { context, type HrTime } from "@opentelemetry/api";
import { suppressTracing } from "@opentelemetry/core";
import { discoverClockOffset } from "./clock-sync-client";

export class DDPSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    context.with(suppressTracing(context.active()), async () => {
      // @ts-expect-error Untyped?
      const clockOffset = Meteor.connection.status().connected
        ? await discoverClockOffset()
          .catch(err => {
            console.log('clock offset discovery failed:', err.message);
            return 0;
          })
        : 0;

      for (const span of spans) {
        // @ts-expect-error writing readonly property.
        span.startTime = sumMillisWithHrTime(clockOffset, span.startTime);
        // @ts-expect-error writing readonly property.
        span.endTime = sumMillisWithHrTime(clockOffset, span.endTime);
        for (const event of span.events) {
          event.time = sumMillisWithHrTime(clockOffset, event.time);
        }
      }
      // const shiftedSpans = spans.map<ReadableSpan>(span => ({
      //   ...span,
      //   startTime: sumMillisWithHrTime(clockOffset, span.startTime),
      //   endTime: sumMillisWithHrTime(clockOffset, span.endTime),
      //   events: span.events.map(event => ({
      //     ...event,
      //     time: sumMillisWithHrTime(clockOffset, event.time),
      //   })),
      // }));

      const req = JsonTraceSerializer.serializeRequest(spans);

      Meteor.callAsync('OTLP/v1/traces', req)
        .then<ExportResult,ExportResult>(
          () => ({ code: ExportResultCode.SUCCESS }),
          err => ({ code: ExportResultCode.FAILED, error: err }))
        .then(resultCallback);
    });
  }
  async shutdown(): Promise<void> {}
}

// I don't really like this, only minimally tested..
function sumMillisWithHrTime(millis: number, time: HrTime): HrTime {
  if (millis == 0) return time;
  if (millis > 0) {
    const fullNanos = time[1] + (millis * 1_000_000);
    const justNanos = fullNanos % 1_000_000_000;
    const extraSeconds = (fullNanos - justNanos) / 1_000_000_000;
    return [time[0] + extraSeconds, justNanos];
  } else {
    const fullNanos = time[1] + (millis * 1_000_000);
    const secondsBehind = Math.ceil(-fullNanos / 1_000_000_000);
    const remainingNanos = fullNanos + (secondsBehind * 1_000_000_000);
    return [time[0] - secondsBehind, remainingNanos];
  }
}
