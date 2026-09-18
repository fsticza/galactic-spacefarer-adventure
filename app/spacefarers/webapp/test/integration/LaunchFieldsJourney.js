/*
 * Hand-written journey (no `.gen` suffix, so the Fiori tools OPA generator will not overwrite it).
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT.
 *
 * These journeys run against @sap-ux/ui5-middleware-fe-mockserver with `generateMockData: true`.
 * There is no CAP server behind them, so there are no before-CREATE handlers, no
 * `SpacefarerLaunched` event and no NotificationService: every value here is fabricated from the
 * metadata. Asserting a call sign's *shape* against this backend would be asserting the mock's
 * behaviour, not ours - a green test proving nothing.
 *
 * So this journey checks the one thing a browser can honestly check: that the three elements the
 * launch handlers populate are actually bound into the object page and rendered. If someone drops
 * `callSign` from `FieldGroup#Identity`, renames `onboardingBonus`, or moves
 * `wormholeCertification` out of the form, this fails - and nothing else in the suite would.
 *
 * The handler and event behaviour itself is covered where it can be exercised for real, against a
 * live service with a live database:
 *   - test/draft.test.ts       'activating the draft runs the CREATE handlers: planet, bonus,
 *                               call sign' - the exact request sequence this UI issues
 *                               (POST draft -> PATCH -> draftActivate)
 *   - test/notifications.test.ts  the cosmic event end: exactly one welcome mail after a
 *                               successful create, carrying the generated call sign; nothing sent
 *                               when the create is rejected; a failing transport leaves the
 *                               message queued
 */
sap.ui.define([
    "sap/ui/test/opaQunit",
    "sap/ui/test/Opa5",
    "./pages/JourneyRunner"
], function (opaTest, Opa5, runner) {
    "use strict";

    // Matches the form label for an element, by its text rather than by a generated control id.
    //
    // sap.fe.test's own onForm().iCheckField() was tried first and abandoned: it matches on
    // Fiori Elements' internal FormElement id scheme, which is undocumented, differs per
    // DataField type, and left the assertion silently waiting until the 90s QUnit timeout with
    // no diagnostic naming what it looked for. Matching the label keeps the test readable and
    // fails fast with a message that says which field is missing.
    //
    // Prefix match, not equality: the theme appends a colon to form labels.
    function labelStartingWith(sText) {
        return {
            controlType: "sap.m.Label",
            matchers: function (oControl) {
                return typeof oControl.getText === "function" && oControl.getText().indexOf(sText) === 0;
            },
            success: function () {
                Opa5.assert.ok(true, "The object page renders the '" + sText + "' field");
            },
            errorMessage: "No '" + sText + "' field on the object page - was it dropped from its UI.FieldGroup?"
        };
    }

    function journey() {
        QUnit.module("Launch fields are bound into the object page");

        opaTest("The object page renders the elements the launch handlers write", function (Given, When, Then) {
            Given.iStartMyApp();

            When.onTheSpacefarersListGenerated.onFilterBar().iExecuteSearch();
            Then.onTheSpacefarersListGenerated.onTable().iCheckRows();
            When.onTheSpacefarersListGenerated.onTable().iPressRow(0);
            Then.onTheSpacefarersObjectPageGenerated.iSeeThisPage();

            // The three elements the before-CREATE handlers write. Values are not asserted: the
            // mock fabricates them per run, so only presence is meaningful against this backend.
            // The labels come from _i18n/i18n.properties, so an unresolved key fails this too.
            Then.waitFor(labelStartingWith("Call Sign"));
            Then.waitFor(labelStartingWith("Wormhole Certification"));
            Then.waitFor(labelStartingWith("Onboarding Bonus"));
        });

        opaTest("Teardown", function (Given, When, Then) {
            Given.iTearDownMyApp();
        });
    }

    // Returns the journey rather than running it - see the comment in SpacefarersListJourney.gen.js
    // for why every journey is run by opaTests.qunit.js in a single runner.run() call.
    return journey;
});
