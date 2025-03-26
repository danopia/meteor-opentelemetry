import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

import { resourceFromAttributes } from '@opentelemetry/resources';

import { settings } from "./settings";
import { getHttpConfiguration } from "./otel-platform/exporter-config";
import { isExportRetryable, OTLPExporterError, parseRetryAfterToMills } from "./otel-platform/exporter-util";

if (settings.enabled) {
  const tracesConfig = getHttpConfiguration('TRACES', 'v1/traces', settings.otlpEndpoint);
  const metricsConfig = getHttpConfiguration('METRICS', 'v1/metrics', settings.otlpEndpoint);
  const logsConfig = getHttpConfiguration('LOGS', 'v1/logs', settings.otlpEndpoint);

  const clientResources = resourceFromAttributes(settings.clientResourceAttributes ?? {});
  clientResources.attributes['service.name'] ??= `unknown_service-browser`;
  const clientAttributeList = Object.entries(clientResources.attributes).map(x => ({
    key: x[0],
    value: { stringValue: `${x[1]}` },
  }));

  function mangleResource(this: Meteor.MethodThisType, x: {resource?: {
    attributes: Array<{ key: string, value: { stringValue?: string } }>;
    droppedAttributesCount: number;
  }}) {
    x.resource ??= { attributes: [], droppedAttributesCount: 0 };
    x.resource.attributes = [
      { key: 'session.public_ip', value: { stringValue: this.connection?.clientAddress } },
      ...clientAttributeList,
      ...x.resource.attributes.filter(x => x.key !== 'service.name'),
    ];
  }

	async function sendJsonData(parameters: typeof tracesConfig, data: unknown) {
    const headers = new Headers(parameters.headers);
    headers.set('content-type', 'application/json');
		return await fetch(parameters.url, {
			method: 'POST',
			body: JSON.stringify(data),
      headers,
			signal: AbortSignal.timeout(parameters.timeoutMillis),
		}).then(async (res) => {
			if (res.ok) {
				const data = await res.text();
				return { status: 'success', data };
			}
			if (isExportRetryable(res.status)) {
				const retryInMillis = parseRetryAfterToMills(res.headers.get('retry-after'));
				return { status: 'retryable', retryInMillis };
			}
			const error = new OTLPExporterError(res.statusText, res.status, await res.text());
			return { status: 'failure', error };
		}).catch(error => ({ status: 'failure', error }));
	}

  Meteor.methods({

    async 'OTLP/v1/traces'(raw: unknown) {
      const payload = raw instanceof Uint8Array
        ? JSON.parse(new TextDecoder().decode(raw))
        : raw;
      check(payload, {
        resourceSpans: Array,
      });
      // @ts-expect-error TODO: untyped structure from client
      payload.resourceSpans?.forEach(mangleResource.bind(this));
      return await sendJsonData(tracesConfig, payload);
    },

    async 'OTLP/v1/metrics'(raw: unknown) {
      const payload = raw instanceof Uint8Array
        ? JSON.parse(new TextDecoder().decode(raw))
        : raw;
      check(payload, {
        resourceMetrics: Array,
      });
      // @ts-expect-error TODO: untyped structure from client
      payload.resourceMetrics?.forEach(mangleResource.bind(this));
      return await sendJsonData(metricsConfig, payload);
    },

    async 'OTLP/v1/logs'(raw: unknown) {
      const payload = raw instanceof Uint8Array
        ? JSON.parse(new TextDecoder().decode(raw))
        : raw;
      check(payload, {
        resourceLogs: Array,
      });
      // @ts-expect-error TODO: untyped structure from client
      payload.resourceLogs?.forEach(mangleResource.bind(this));
      return await sendJsonData(logsConfig, payload);
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
