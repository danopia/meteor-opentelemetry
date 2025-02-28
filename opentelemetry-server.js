// Variables exported by this module can be imported by other packages and
// applications. See opentelemetry-tests.js for an example of importing.
export const name = 'opentelemetry';

import './ddp-otlp-server'
import './clock-sync-server'
import './tracer-server'

export {
  traceAsyncFunc,
  tracedInterval,
  tracedTimeout,
} from './api';
