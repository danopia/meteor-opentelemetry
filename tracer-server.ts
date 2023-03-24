import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

import { Resource } from '@opentelemetry/resources';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { PeriodicExportingMetricReader, AggregationTemporality, MeterProvider } from '@opentelemetry/sdk-metrics';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

import { MeteorContextManager } from "./server/context-manager";
import { settings } from "./settings";

import { wrapFibers } from './instrument/fibers'
import './instrument/ddp-server'
import './instrument/webapp'
import './instrument/mongodb'

if (settings.enabled) {
  const resource = new Resource(settings.serverResourceAttributes ?? {});

  const metricsProvider = new MeterProvider({
    resource,
  });
  metricsProvider.addMetricReader(new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 20_000,
  }));

  const provider = new NodeTracerProvider({
    resource,
  });
  provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter()));
  provider.register({
    contextManager: new MeteorContextManager().enable(),
  });

  registerInstrumentations({
    tracerProvider: provider,
    meterProvider: metricsProvider,
  })

  wrapFibers(); // apparently needs to happen after the metrics provider is set up
}
