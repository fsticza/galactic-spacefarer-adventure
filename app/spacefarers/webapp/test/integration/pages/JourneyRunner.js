sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"galactic/spacefarers/test/integration/pages/SpacefarersList.gen",
	"galactic/spacefarers/test/integration/pages/SpacefarersObjectPage.gen"
], function (JourneyRunner, SpacefarersListGenerated, SpacefarersObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        // The checked-in sandbox, not the fiori-tools-preview middleware's generated
        // /test/flp.html. That one exists only under `ui5 serve`, so the journeys used to
        // exercise a shell that the CAP-served app - the one the README tells people to open -
        // never had. Pointing them here means CI verifies the entry point users actually get,
        // including the shell back button that returns them from the object page to the list.
        launchUrl: sap.ui.require.toUrl('galactic/spacefarers') + '/test/flpSandbox.html#Spacefarer-display',
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

