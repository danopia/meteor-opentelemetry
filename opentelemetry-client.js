// Write your package code here!

// Variables exported by this module can be imported by other packages and
// applications. See opentelemetry-tests.js for an example of importing.
export const name = 'opentelemetry';

import './tracer-client';

export {
  traceAsyncFunc,
  tracedInterval,
  tracedTimeout,
} from './api';
