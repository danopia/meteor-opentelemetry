import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

import { Resource } from '@opentelemetry/resources';
import { IExportTraceServiceRequest, IKeyValue } from '@opentelemetry/otlp-transformer';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { sendWithHttp } from '@opentelemetry/otlp-exporter-base';

import { settings } from "./settings";

if (settings.enabled) {
  const clientExporter = new OTLPTraceExporter();

  const clientResources = new Resource(settings.clientResourceAttributes ?? {});
  clientResources.attributes['service.name'] ??= `unknown_service-browser`;
  const clientAttributeList = Object.entries(clientResources.attributes).map<IKeyValue>(x => ({
    key: x[0],
    value: { stringValue: `${x[1]}` },
  }));

  Meteor.methods({
    async 'OTLP/v1/traces'(tracePayload: IExportTraceServiceRequest) {
      check(tracePayload, {
        resourceSpans: Array,
      });
      for (const x of tracePayload.resourceSpans) {
        x.resource ??= { attributes: [], droppedAttributesCount: 0 };
        x.resource.attributes = [
          { key: 'session.public_ip', value: { stringValue: this.connection?.clientAddress } },
          ...clientAttributeList,
          ...x.resource.attributes.filter(x => x.key !== 'service.name'),
        ];
      }
      await new Promise<void>((ok, fail) =>
        sendWithHttp(clientExporter, JSON.stringify(tracePayload), 'application/json', ok, fail));
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
