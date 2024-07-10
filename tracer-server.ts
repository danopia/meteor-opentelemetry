import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { PeriodicExportingMetricReader, MeterProvider } from '@opentelemetry/sdk-metrics';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

import { settings } from "./settings";

import './instrument/ddp-server'
import './instrument/mongodb'

if (settings.enabled) {
  const resource = new Resource(settings.serverResourceAttributes ?? {});

  const metricsProvider = new MeterProvider({
    resource,
  });
  metricsProvider.addMetricReader(new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/metrics` : undefined,
    }),
    exportIntervalMillis: 20_000,
  }));
  metrics.setGlobalMeterProvider(metricsProvider);

  const provider = new NodeTracerProvider({
    resource,
  });
  provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
    url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/traces` : undefined,
  })));
  // this also sets the global trace provider:
  provider.register({
  });
}
