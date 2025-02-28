Package.describe({
  name: 'danopia:opentelemetry',
  version: '0.8.0-beta.2',
  summary: 'Meteor v3 instrumentations for OpenTelemetry tracing',
  git: 'https://github.com/danopia/meteor-opentelemetry',
  documentation: 'README.md',
});

Npm.depends({

  // This needs to be a sort of peer dependency
  // TODO: consider https://github.com/Meteor-Community-Packages/check-npm-versions
  // '@opentelemetry/api': '1.9.0',

  '@opentelemetry/sdk-trace-node': '1.30.1',
  '@opentelemetry/sdk-trace-web': '1.30.1',
  '@opentelemetry/semantic-conventions': '1.30.0',

  '@opentelemetry/otlp-transformer': '0.57.2',
  '@opentelemetry/exporter-trace-otlp-http': '0.57.2',
  '@opentelemetry/exporter-metrics-otlp-http': '0.57.2',
  '@opentelemetry/exporter-logs-otlp-http': '0.57.2',

});

Package.onUse(function(api) {
  api.versionsFrom('3.0');
  api.use('ecmascript');
  api.use('montiapm:meteorx@2.3.1');
  api.export('resource');
  api.export('tracer');
  api.mainModule('opentelemetry-client.js', 'client');
  api.mainModule('opentelemetry-server.js', 'server');

  // TypeScript setup
  api.use('typescript');
  api.use('zodern:types@1.0.13');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('danopia:opentelemetry');
  api.mainModule('opentelemetry-tests.js');
});
