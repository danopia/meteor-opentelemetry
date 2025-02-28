// Subset of experimental/packages/otlp-exporter-base/src/configuration/otlp

/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { baggageUtils } from '@opentelemetry/core';
import { diag } from '@opentelemetry/api';

function getStaticHeadersFromEnv(
  signalIdentifier: string
): Record<string, string> | undefined {
  const signalSpecificRawHeaders =
    process.env[`OTEL_EXPORTER_OTLP_${signalIdentifier}_HEADERS`]?.trim();
  const nonSignalSpecificRawHeaders =
    process.env['OTEL_EXPORTER_OTLP_HEADERS']?.trim();

  const signalSpecificHeaders = baggageUtils.parseKeyPairsIntoRecord(
    signalSpecificRawHeaders
  );
  const nonSignalSpecificHeaders = baggageUtils.parseKeyPairsIntoRecord(
    nonSignalSpecificRawHeaders
  );

  if (
    Object.keys(signalSpecificHeaders).length === 0 &&
    Object.keys(nonSignalSpecificHeaders).length === 0
  ) {
    return undefined;
  }

  // headers are combined instead of overwritten, with the specific headers taking precedence over
  // the non-specific ones.
  return Object.assign(
    {},
    baggageUtils.parseKeyPairsIntoRecord(nonSignalSpecificRawHeaders),
    baggageUtils.parseKeyPairsIntoRecord(signalSpecificRawHeaders)
  );
}

function appendRootPathToUrlIfNeeded(url: string): string | undefined {
  try {
    const parsedUrl = new URL(url);
    // This will automatically append '/' if there's no root path.
    return parsedUrl.toString();
  } catch {
    diag.warn(
      `Configuration: Could not parse environment-provided export URL: '${url}', falling back to undefined`
    );
    return undefined;
  }
}

function appendResourcePathToUrl(
  url: string,
  path: string
): string | undefined {
  try {
    // just try to parse, if it fails we catch and warn.
    new URL(url);
  } catch {
    diag.warn(
      `Configuration: Could not parse environment-provided export URL: '${url}', falling back to undefined`
    );
    return undefined;
  }

  if (!url.endsWith('/')) {
    url = url + '/';
  }
  url += path;

  try {
    // just try to parse, if it fails we catch and warn.
    new URL(url);
  } catch {
    diag.warn(
      `Configuration: Provided URL appended with '${path}' is not a valid URL, using 'undefined' instead of '${url}'`
    );
    return undefined;
  }

  return url;
}

function getNonSpecificUrlFromEnv(
  signalResourcePath: string
): string | undefined {
  let envUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (envUrl == null || envUrl === '') {
    return undefined;
  }
  return appendResourcePathToUrl(envUrl, signalResourcePath);
}

function getSpecificUrlFromEnv(signalIdentifier: string): string | undefined {
  const envUrl =
    process.env[`OTEL_EXPORTER_OTLP_${signalIdentifier}_ENDPOINT`]?.trim();
  if (envUrl == null || envUrl === '') {
    return undefined;
  }
  return appendRootPathToUrlIfNeeded(envUrl);
}

function parseAndValidateTimeoutFromEnv(
  timeoutEnvVar: string
): number | undefined {
  const envTimeout = process.env[timeoutEnvVar]?.trim();
  if (envTimeout != null && envTimeout !== '') {
    const definedTimeout = Number(envTimeout);
    if (
      !Number.isNaN(definedTimeout) &&
      Number.isFinite(definedTimeout) &&
      definedTimeout > 0
    ) {
      return definedTimeout;
    }
    diag.warn(
      `Configuration: ${timeoutEnvVar} is invalid, expected number greater than 0 (actual: ${envTimeout})`
    );
  }
  return undefined;
}

function getTimeoutFromEnv(signalIdentifier: string) {
  const specificTimeout = parseAndValidateTimeoutFromEnv(
    `OTEL_EXPORTER_OTLP_${signalIdentifier}_TIMEOUT`
  );
  const nonSpecificTimeout = parseAndValidateTimeoutFromEnv(
    'OTEL_EXPORTER_OTLP_TIMEOUT'
  );

  return specificTimeout ?? nonSpecificTimeout;
}

/**
 * Reads and returns configuration from the environment
 *
 * @param signalIdentifier all caps part in environment variables that identifies the signal (e.g.: METRICS, TRACES, LOGS)
 * @param signalResourcePath signal resource path to append if necessary (e.g.: v1/metrics, v1/traces, v1/logs)
 */
export function getHttpConfiguration(
  signalIdentifier: string,
  signalResourcePath: string,
  baseUrl?: string,
) {
  return {
    timeoutMillis: getTimeoutFromEnv(signalIdentifier) ?? 30_000,
    url:
      getSpecificUrlFromEnv(signalIdentifier) ??
      getNonSpecificUrlFromEnv(signalResourcePath) ??
      getUrlFromBase(signalResourcePath, baseUrl),
    headers: getStaticHeadersFromEnv(signalIdentifier),
  };
}

function getUrlFromBase(signalResourcePath: string, baseUrl = 'http://localhost:4318') {
  return `${baseUrl.replace(/\/$/, '')}/${signalResourcePath}`;
}
