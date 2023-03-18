import { trace, SpanKind } from "@opentelemetry/api";
import { Mongo } from "meteor/mongo";
import {
  DbSystemValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';

const tracer = trace.getTracer('meteor.mongo');

MeteorX.onReady(() => {
  const x1 = MeteorX.MongoCursor.prototype as InstanceType< typeof Mongo.Cursor>;
  // cursors have _cursorDescription: {collectionName, selector, options}
  const origFind = x1.fetch;
  x1.fetch = function (this: Mongo.Cursor<unknown>, ...args) {
    // console.error(this, args)
    return tracer.startActiveSpan('find.fetch '+this._cursorDescription.collectionName,
      cursorSpanOptions(this, 'find.fetch'),
      span => {
        try {
          const resp = origFind.apply(this, args);
          span.setAttribute('db.mongodb.documents_returned', resp.length);
          return resp;
        } finally {
          span.end();
      }
    });
  }
  const origCount = x1.count;
  x1.count = function (this: Mongo.Cursor<unknown>, ...args) {
    return tracer.startActiveSpan('find.count '+this._cursorDescription.collectionName,
      cursorSpanOptions(this, 'find.count'),
      span => {
        try {
          const result = origCount.apply(this, args)
          span.setAttribute('db.mongodb.documents_returned', result);
          return result;
        } finally {
          span.end();
        }
      });
  }
  const origForEach = x1.forEach;
  x1.forEach = function (this: Mongo.Cursor<unknown>, ...args) {
    return tracer.startActiveSpan('find.forEach '+this._cursorDescription.collectionName,
      cursorSpanOptions(this, 'find.forEach'),
      span => {
        try {
          return origForEach.apply(this, args)
        } finally {
          span.end();
        }
      });
  }
  const origMap = x1.map;
  x1.map = function (this: Mongo.Cursor<unknown>, ...args) {
    return tracer.startActiveSpan('find.map '+this._cursorDescription.collectionName,
      cursorSpanOptions(this, 'find.map'),
      span => {
        try {
          return origMap.apply(this, args)
        } finally {
          span.end();
        }
      });
  }
});

const x2 = Mongo.Collection.prototype as InstanceType< typeof Mongo.Collection>;
const origFindOne = x2.findOne;
x2.findOne = function (this: Mongo.Collection<unknown>, ...args) {
  // drop MeteorX lookups
  if (this.rawCollection().collectionName.startsWith('__dummy_coll_')) {
    return origFindOne.apply(this, args);
  }
  return tracer.startActiveSpan('findOne '+this.rawCollection().collectionName,
    spanOptions(this, 'findOne', args[0]),
    span => {
      try {
        return origFindOne.apply(this, args)
      } finally {
        span.end();
      }
    });
}
const origCreateIndex = x2.createIndex;
x2.createIndex = function (this: Mongo.Collection<unknown>, ...args) {
  return tracer.startActiveSpan('createIndex '+this.rawCollection().collectionName,
    spanOptions(this, 'createIndex', args[0]),
    span => {
      try {
        return origCreateIndex.apply(this, args)
      } finally {
        span.end();
      }
    });
}
const origInsert = x2.insert;
x2.insert = function (this: Mongo.Collection<unknown>, ...args) {
  return tracer.startActiveSpan('insert '+this.rawCollection().collectionName,
    spanOptions(this, 'insert', args[0]),
    span => {
      try {
        return origInsert.apply(this, args)
      } finally {
        span.end();
      }
    });
}
const origRemove = x2.remove;
x2.remove = function (this: Mongo.Collection<unknown>, ...args) {
  return tracer.startActiveSpan('remove '+this.rawCollection().collectionName,
    spanOptions(this, 'remove', args[0]),
    span => {
      try {
        const result = origRemove.apply(this, args)
        span.setAttribute('db.mongodb.documents_affected', result.numberAffected);
        return result;
      } finally {
        span.end();
      }
    });
}
const origUpdate = x2.update;
x2.update = function (this: Mongo.Collection<unknown>, ...args) {
  return tracer.startActiveSpan('update '+this.rawCollection().collectionName,
    spanOptions(this, 'update', args[0]),
    span => {
      try {
        const result = origUpdate.apply(this, args)
        span.setAttribute('db.mongodb.documents_affected', result.numberAffected);
        return result;
      } finally {
        span.end();
    }
  });
}
const origUpsert = x2.upsert;
x2.upsert = function (this: Mongo.Collection<unknown>, ...args) {
  return tracer.startActiveSpan('upsert '+this.rawCollection().collectionName,
    spanOptions(this, 'upsert', args[0]),
    span => {
      try {
        return origUpsert.apply(this, args)
      } finally {
        span.end();
      }
    });
}


function spanOptions(coll: Mongo.Collection<{}>, operation: string, filter: unknown) {
  return {
    kind: SpanKind.CLIENT,
    attributes: {
      [SemanticAttributes.DB_SYSTEM]: DbSystemValues.MONGODB,
      [SemanticAttributes.DB_NAME]: coll.rawDatabase().databaseName,
      [SemanticAttributes.DB_MONGODB_COLLECTION]: coll.rawCollection().collectionName,
      [SemanticAttributes.DB_OPERATION]: operation,
      [SemanticAttributes.DB_STATEMENT]: filter ? _defaultDbStatementSerializer(filter) : null,
    }
  };
}


function cursorSpanOptions(cursor: Mongo.Cursor<{}>, operation: string) {
  // console.error({db: cursor._mongo.db.databaseName});
  return {
    kind: SpanKind.CLIENT,
    attributes: {
      [SemanticAttributes.DB_SYSTEM]: DbSystemValues.MONGODB,
      [SemanticAttributes.DB_NAME]: cursor._mongo.db.databaseName,
      [SemanticAttributes.DB_MONGODB_COLLECTION]: cursor._cursorDescription.collectionName,
      [SemanticAttributes.DB_OPERATION]: operation,
      [SemanticAttributes.DB_STATEMENT]: _defaultDbStatementSerializer(cursor._cursorDescription.selector),
    }
  };
}


// It is possible to get instrumentation from mongodb driver, but the Meteor context seems long gone...

// const client = MongoInternals.defaultRemoteCollectionDriver().mongo.client;
// // contextManager.bind()
// client.on('commandStarted', evt => {
//   console.error('commandStarted', evt.commandName);
//   console.error(trace.getActiveSpan()?.isRecording())
//   console.error('fiber', Fiber.current)
//   // console.error(new Error().stack)
// })



// const mcnof_op = Npm.require('../node_modules/meteor/npm-mongo/node_modules/mongodb/lib/operations.js')
// console.log({mcnof_op})

// const mcnof_pool = Npm.require('../node_modules/meteor/npm-mongo/node_modules/mongodb/lib/cmap/connection_pool.js')
// const checkOOO = mcnof_pool.ConnectionPool.prototype.checkOut;
// mcnof_pool.ConnectionPool.prototype.checkOut = function (cb) {
//   const ctx = context.active();
//   console.log('checkout', trace.getSpan(ctx)?.isRecording());
//   checkOOO.call(this, (...args) => context.with(ctx, () => cb(...args)));
// }

// const mcnofg = Npm.require('../node_modules/meteor/npm-mongo/node_modules/mongodb/lib/cmap/connection.js')
// const ins = new MongoDBInstrumentation();
// ins.init()[1].files[0].patch(mcnofg);
// const orig = mcnofg.Connection.prototype.command;
// mcnofg.Connection.prototype.command = function (...args) {
//   console.error(args[0].collection, trace.getActiveSpan()?.isRecording());
//   if (args[0].collection == 'Profiles') console.log(new Error().stack)
//   return orig.apply(this, args);
// }




// const origOpen = MongoInternals.defaultRemoteCollectionDriver().open;
// MongoInternals.defaultRemoteCollectionDriver().mongo.client.withSession(x => x.).open = (name, conn) => {
//   console.log('open', name);
//   const coll = origOpen.call(MongoInternals.defaultRemoteCollectionDriver(), name, conn);
//   return new Proxy(coll, {
//     // apply(real, self, args) {
//     //   console.log(args);
//     //   return
//     // }
//     get(target, key) {
//       console.log('get', key);
//       return target[key];
//     }
//   })
// }


function _defaultDbStatementSerializer(commandObj: string | Record<string, unknown>) {
  const enhancedDbReporting = false;//!!this._config?.enhancedDatabaseReporting;
  const resultObj = typeof commandObj == 'string'
    ? { _id: commandObj }
    : enhancedDbReporting
      ? commandObj
      : Object.keys(commandObj).reduce((obj, key) => {
          obj[key] = '?';
          return obj;
        }, {} as { [key: string]: unknown });
  return JSON.stringify(resultObj);
}
