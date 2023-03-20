import { Context, ContextManager, ROOT_CONTEXT } from '@opentelemetry/api';
import { Meteor } from 'meteor/meteor';

import Fiber from 'fibers';
import { AbstractAsyncHooksContextManager } from './AbstractAsyncHooksContextManager';

export class MeteorContextManager extends AbstractAsyncHooksContextManager implements ContextManager {
  envVar: Meteor.EnvironmentVariable<Context>;
  constructor() {
    super();
    this.envVar = new Meteor.EnvironmentVariable<Context>();
  }

  active(): Context {
    return this.envVar.getOrNullIfOutsideFiber() ?? ROOT_CONTEXT;
  }
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    const cb = thisArg == null ? fn : fn.bind(thisArg);
    if (!Fiber.current) {
      // We just tolerate running without fiber.
      // This happens on async operations within general-audience NodeJS libraries.
      // Maybe a metric could be added so we could drive this to zero, but a general fix isn't clear.
      // The downside is that spans happening outside a fiber simply aren't observable.
      return cb(...args);
    }
    return this.envVar.withValue(context, () => cb(...args));
  }

  // Meteor's context manager is always active - we don't control the lifecycle
  enable(): this {
    return this;
  }
  disable(): this {
    return this;
  }

}
