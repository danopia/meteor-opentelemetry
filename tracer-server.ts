import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { PeriodicExportingMetricReader, MeterProvider } from '@opentelemetry/sdk-metrics';

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
    exporter: new OTLPMetricExporter({
      url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/metrics` : undefined,
    }),
    exportIntervalMillis: 20_000,
  }));

  const provider = new NodeTracerProvider({
    resource,
  });
  provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
    url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/traces` : undefined,
  })));
  provider.register({
    contextManager: new MeteorContextManager().enable(),
  });

  // This is probably something to be called by the implementer, not the library
  // registerInstrumentations({
  //   tracerProvider: provider,
  //   meterProvider: metricsProvider,
  // })

  metrics.setGlobalMeterProvider(metricsProvider);

  wrapFibers(); // apparently needs to happen after the metrics provider is set up
}
