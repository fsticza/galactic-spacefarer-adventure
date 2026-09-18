// This file is loaded directly via a <script> tag (see opaTests.qunit.html), not as an AMD
// module itself, so it uses the global sap.ui.require() rather than sap.ui.define() — and
// therefore needs fully qualified module names rather than "./" relative ones.
sap.ui.require([
    "galactic/spacefarers/test/integration/pages/JourneyRunner",
    "galactic/spacefarers/test/integration/SpacefarersListJourney.gen",
    "galactic/spacefarers/test/integration/SpacefarersObjectPageJourney.gen",
    "galactic/spacefarers/test/integration/LaunchFieldsJourney"
], function (runner, listJourney, objectPageJourney, launchFieldsJourney) {
    "use strict";
    // Every journey file returns its journey function rather than running it itself, so that the
    // shared JourneyRunner's page objects (see the comment in SpacefarersListJourney.gen.js) are
    // registered exactly once, by this single call.
    runner.run([listJourney, objectPageJourney, launchFieldsJourney]);
});
