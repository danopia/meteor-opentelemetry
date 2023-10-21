import { Meteor } from "meteor/meteor";

import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-web';
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { createExportTraceServiceRequest } from '@opentelemetry/otlp-transformer';
import { context } from "@opentelemetry/api";
import { suppressTracing, isTracingSuppressed } from "@opentelemetry/core";
import { discoverClockOffset } from "./clock-sync-client";

export class DDPSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    context.with(suppressTracing(context.active()), async () => {
      const clockOffset = Meteor.connection.status().connected
        ? await discoverClockOffset()
          .catch(err => {
            console.log('clock offset discovery failed:', err.message);
            return 0;
          })
        : 0;

      const req = createExportTraceServiceRequest(spans, true);

      for (const resSpans of req.resourceSpans ?? []) {
        for (const scopeSpans of resSpans.scopeSpans) {
          for (const span of scopeSpans.spans ?? []) {
            span.startTimeUnixNano += (clockOffset * 1_000_000);
            span.endTimeUnixNano += (clockOffset * 1_000_000);
            for (const event of span.events ?? []) {
              event.timeUnixNano += (clockOffset * 1_000_000);
            }
          }
        }
      }

      Meteor.callAsync('OTLP/v1/traces', req)
        .then<ExportResult,ExportResult>(
          () => ({ code: ExportResultCode.SUCCESS }),
          err => ({ code: ExportResultCode.FAILED, error: err }))
        .then(resultCallback);
    });
  }
  async shutdown(): Promise<void> {}
}
