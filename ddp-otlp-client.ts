import { Meteor } from "meteor/meteor";

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-web';
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { createExportTraceServiceRequest } from '@opentelemetry/otlp-transformer';

export class DDPSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const req = createExportTraceServiceRequest(spans, true);
    Meteor.callAsync('OTLP/v1/traces', req)
      .then<ExportResult,ExportResult>(
        () => ({ code: ExportResultCode.SUCCESS }),
        err => ({ code: ExportResultCode.FAILED, error: err }))
      .then(resultCallback);
  }
  async shutdown(): Promise<void> {}
}
