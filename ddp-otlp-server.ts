import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

import { Resource } from '@opentelemetry/resources';
import {
  IExportTraceServiceRequest,
  IExportMetricsServiceRequest,
  IKeyValue,
  IResource,
} from '@opentelemetry/otlp-transformer';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { sendWithHttp } from '@opentelemetry/otlp-exporter-base';

import { settings } from "./settings";

if (settings.enabled) {
  // These are really only used for their URL, because we receive pre-transformed payloads
  const tracesExporter = new OTLPTraceExporter({
    url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/traces` : void 0,
  });
  const metricsExporter = new OTLPMetricExporter({
    url: settings.otlpEndpoint ? `${settings.otlpEndpoint}/v1/metrics` : void 0,
  });

  const clientResources = new Resource(settings.clientResourceAttributes ?? {});
  clientResources.attributes['service.name'] ??= `unknown_service-browser`;
  const clientAttributeList = Object.entries(clientResources.attributes).map<IKeyValue>(x => ({
    key: x[0],
    value: { stringValue: `${x[1]}` },
  }));

  function mangleResource(x: {resource?: IResource}) {
    x.resource ??= { attributes: [], droppedAttributesCount: 0 };
    x.resource.attributes = [
      { key: 'session.public_ip', value: { stringValue: this.connection?.clientAddress } },
      ...clientAttributeList,
      ...x.resource.attributes.filter(x => x.key !== 'service.name'),
    ];
  }

  Meteor.methods({

    async 'OTLP/v1/traces'(payload: IExportTraceServiceRequest) {
      check(payload, {
        resourceSpans: Array,
      });
      payload.resourceSpans?.forEach(mangleResource);
      await new Promise<void>((ok, fail) =>
        sendWithHttp(tracesExporter, JSON.stringify(payload), 'application/json', ok, fail));
    },

    async 'OTLP/v1/metrics'(payload: IExportMetricsServiceRequest) {
      check(payload, {
        resourceMetrics: Array,
      });
      payload.resourceMetrics?.forEach(mangleResource);
      await new Promise<void>((ok, fail) =>
        sendWithHttp(metricsExporter._otlpExporter, JSON.stringify(payload), 'application/json', ok, fail));
    },

    async 'OTLP/v1/logs'(payload: IExportMetricsServiceRequest) {
      // TODO: blocked on https://github.com/open-telemetry/opentelemetry-js/pull/3764
    },

  });

} else {
  // If we aren't set up for telemetry then we just drop any OTLP we receive
  Meteor.methods({
    'OTLP/v1/traces'() {},
    'OTLP/v1/metrics'() {},
    'OTLP/v1/logs'() {},
  });
}
