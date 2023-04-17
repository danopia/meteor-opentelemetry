import { Meteor } from "meteor/meteor";

Meteor.methods({
  'OTLP/server-time'() {
    return Date.now();
  },
});
