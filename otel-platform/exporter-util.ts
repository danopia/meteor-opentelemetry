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

export function isExportRetryable(statusCode: number) {
	const retryCodes = [429, 502, 503, 504];
	return retryCodes.includes(statusCode);
}
export function parseRetryAfterToMills(retryAfter: string | null) {
	if (retryAfter == null) {
		return undefined;
	}
	const seconds = Number.parseInt(retryAfter, 10);
	if (Number.isInteger(seconds)) {
		return seconds > 0 ? seconds * 1000 : -1;
	}
	const delay = new Date(retryAfter).getTime() - Date.now();
	if (delay >= 0) {
		return delay;
	}
	return 0;
}

export class OTLPExporterError extends Error {
	constructor(message: string, code: number, data: string) {
		super(message);
		this.name = 'OTLPExporterError';
		this.data = data;
		this.code = code;
	}
}
