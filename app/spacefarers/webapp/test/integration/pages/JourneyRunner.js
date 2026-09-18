sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"galactic/spacefarers/test/integration/pages/SpacefarersList.gen",
	"galactic/spacefarers/test/integration/pages/SpacefarersObjectPage.gen"
], function (JourneyRunner, SpacefarersListGenerated, SpacefarersObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        // Stays on the fiori-tools-preview middleware's generated /test/flp.html, NOT the
        // checked-in test/flpSandbox.html that humans use.
        //
        // Pointing these journeys at the full ushell sandbox was tried and reverted: CI came back
        // 3 of 5 FAILED in 4m30s, with real assertion failures inside sap.fe.test's own
        // FilterBarActions (`iExecuteSearch`, Expected: true / Actual: false), not timeouts. The
        // generated page objects are written against this lightweight preview shell, and a full
        // launchpad changes what they find.
        //
        // So the suite covers the app, not the launchpad wrapper around it. The sandbox is
        // verified by opening it - see the entry-point table in the README.
        launchUrl: sap.ui.require.toUrl('galactic/spacefarers') + '/test/flp.html#app-preview',
        pages: {
			onTheSpacefarersListGenerated: SpacefarersListGenerated,
			onTheSpacefarersObjectPageGenerated: SpacefarersObjectPageGenerated
        },
        async: true,
        // The default 30s OPA5 step timeout is tight for a cold headless run: every UI5
        // framework resource (sap.fe.templates, sap.ushell sandbox, themes, ...) is fetched
        // fresh from the SAPUI5 CDN by a throwaway browser profile with no HTTP cache to
        // warm up, and that first "iStartMyApp" step alone was observed to intermittently
        // exceed 30s under ordinary network variance — not a broken selector or a real
        // hang, just slow. Measured empirically: 2 of 3 consecutive local runs at the
        // default timeout failed on "Opa timeout after 30 seconds" during iStartMyApp / the
        // list-to-object-page navigation; a genuinely broken step still fails, just after
        // waiting longer.
        opaConfig: {
            timeout: 90,
            pollingInterval: 400
        }
    });

    return runner;
});

