"use strict";

// Runs the OPA5 journeys under webapp/test/integration headlessly.
//
// - "ui5" framework (karma-ui5) drives an internal UI5 Tooling server built from
//   ui5-mock.yaml, so the very same fiori-tools-proxy (UI5 framework resources from the
//   SAPUI5 CDN), fiori-tools-preview (dynamic /test/flp.html FLP sandbox) and
//   sap-fe-mockserver (mock OData backend, no CAP server needed) middleware run for the
//   test browser as they would for `npm run start:mock`.
// - "html" mode (the default) just loads the existing opaTests.qunit.html test page in an
//   iframe, so no extra karma test-framework adapters are involved.
//
// See package.json's "test:opa" script and the root README for how this is invoked.
module.exports = function (config) {
    config.set({
        // Must be the UI5 project root (where ui5.yaml / ui5-mock.yaml live), not webapp/.
        basePath: "",

        frameworks: ["ui5"],
        ui5: {
            configPath: "ui5-mock.yaml",
            mode: "html",
            testpage: "webapp/test/integration/opaTests.qunit.html",
            failOnEmptyTestPage: true
        },

        browsers: ["ChromeHeadlessCI"],
        customLaunchers: {
            ChromeHeadlessCI: {
                base: "ChromeHeadless",
                // --no-sandbox: Chrome's setuid sandbox needs privileges CI containers don't
                // grant; --disable-dev-shm-usage avoids /dev/shm running out in small runners.
                flags: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
            }
        },
        singleRun: true,

        // The FLP sandbox + Fiori elements templates pull in a lot of UI5 framework
        // resources from the CDN; give that, and the mock server's on-the-fly data
        // generation, enough headroom to avoid flaking on a loaded CI runner. These need to
        // comfortably exceed the per-step OPA5 timeout (see opaConfig.timeout in
        // pages/JourneyRunner.js) or karma will kill the browser before OPA5 itself
        // reports the slow step.
        browserDisconnectTimeout: 30000,
        browserNoActivityTimeout: 150000,
        captureTimeout: 180000,
        concurrency: 1
    });
};
