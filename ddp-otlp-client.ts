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

      const req = createExportTraceServiceRequest(spans, {
        useHex: true,
        useLongBits: false,
      });

      for (const resSpans of req.resourceSpans ?? []) {
        for (const scopeSpans of resSpans.scopeSpans) {
          for (const span of scopeSpans.spans ?? []) {
            // We don't want to deal with LongBit high/low, instead we take strings and manipulate them that way
            span.startTimeUnixNano = `${Math.round(+span.startTimeUnixNano.slice(0, -6) + clockOffset)}000000`;
            span.endTimeUnixNano = `${Math.round(+span.endTimeUnixNano.slice(0, -6) + clockOffset)}000000`;
            for (const event of span.events ?? []) {
              event.timeUnixNano = `${Math.round(+event.timeUnixNano.slice(0, -6) + clockOffset)}000000`;
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
