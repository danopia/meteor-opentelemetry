import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { PeriodicExportingMetricReader, MeterProvider } from '@opentelemetry/sdk-metrics';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

import { settings } from "./settings";

import './instrument/ddp-server'
import './instrument/mongodb'

if (settings.enabled) {
  const resource = new Resource(settings.serverResourceAttributes ?? {});

  const metricsProvider = new MeterProvider({
    resource,
    mergeResourceWithDefaults: true,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/metrics` : undefined,
        }),
        exportIntervalMillis: 60_000,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(metricsProvider);

  const tracer = new NodeTracerProvider({
    resource,
    mergeResourceWithDefaults: true,
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({
        url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/traces` : undefined,
      })),
    ],
  });
  // this also sets the global trace provider:
  tracer.register({});

  const logger = new LoggerProvider({
    resource,
    mergeResourceWithDefaults: true,
  });
  logger.addLogRecordProcessor(new BatchLogRecordProcessor(new OTLPLogExporter({
    url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/logs` : undefined,
  })));
  logs.setGlobalLoggerProvider(logger);
}
