// Import Tinytest from the tinytest Meteor package.
import { Tinytest } from "meteor/tinytest";

// Import and rename a variable exported by opentelemetry.js.
import { name as packageName } from "meteor/danopia:opentelemetry";

// Write your tests here!
// Here is an example.
Tinytest.add('opentelemetry - example', function (test) {
  test.equal(packageName, "opentelemetry");
});
