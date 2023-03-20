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

  // Use stack when we are called outside Meteor
  public _currentContext = ROOT_CONTEXT;

  active(): Context {
    if (!Fiber.current) return this._currentContext;
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
      // Since we aren't in a Fiber, we can trust that the user code won't block us
      // So we just use the sync stack to keep context
      // This kicks in when spans get out into internal NPM packages
      const previousContext = this._currentContext;
      this._currentContext = context || ROOT_CONTEXT;
      try {
        return cb(...args);
      } finally {
        this._currentContext = previousContext;
      }
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
