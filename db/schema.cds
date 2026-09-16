namespace galactic;

using { cuid, managed, sap.common.CodeList } from '@sap/cds/common';

/**
 * Planets of the SAP galaxy.
 * `code` doubles as the tenancy key: users carry a `planet` attribute and only ever see
 * spacefarers whose origin planet matches it (see SpacefarerService).
 */
@cds.odata.valuelist
entity Planets : CodeList {
  key code        : String(10) @title: 'Planet';
      galaxy      : String(60) @title: 'Galaxy';
      hazardLevel : Integer    @title: 'Hazard Level' @assert.range: [1, 5];
}

/** Regulation spacesuit colors, maintained as a code list so Fiori renders a value help. */
@cds.odata.valuelist
entity SpacesuitColors : CodeList {
  key code : String(10) @title: 'Spacesuit Color';
      hex  : String(7)  @title: 'Hex Value';
}

/** Intergalactic departments a spacefarer can belong to. */
@cds.odata.valuelist
entity Departments : cuid, managed {
  name         : String(100) @mandatory @title: 'Department';
  description  : String(500) @title: 'Description';
  headquarters : Association to Planets @title: 'Headquarters';
  positions    : Association to many Positions on positions.department = $self;
  spacefarers  : Association to many Spacefarers on spacefarers.department = $self;
}

/** Positions within a department, each demanding a minimum wormhole navigation skill. */
@cds.odata.valuelist
entity Positions : cuid {
  title            : String(100) @mandatory @title: 'Position';
  rank             : Integer @title: 'Rank' @assert.range: [1, 10];
  minWormholeSkill : Integer default 1 @title: 'Min. Wormhole Skill' @assert.range: [1, 10];
  department       : Association to Departments @title: 'Department';
}

/** A spacefarer on their journey through the SAP galaxy. */
@assert.unique: { email: [email] }
entity Spacefarers : cuid, managed {
  name                    : String(100) @mandatory @title: 'Name';
  email                   : String(255) @mandatory @title: 'Email'
                            @assert.format: '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  stardustCollection      : Integer default 0 @title: 'Stardust Collection' @assert.range: [0, 1000000];
  wormholeNavigationSkill : Integer default 1 @title: 'Wormhole Navigation Skill' @assert.range: [1, 10];
  // Required, but defaulted from the user's planet attribute by the service (see srv/spacefarer-service.js),
  // hence enforced there instead of via @mandatory (which would run before the default is applied).
  originPlanet            : Association to Planets @assert.target @title: 'Origin Planet';
  spacesuitColor          : Association to SpacesuitColors @mandatory @assert.target @title: 'Spacesuit Color';
  department              : Association to Departments @assert.target @title: 'Department';
  position                : Association to Positions @assert.target @title: 'Position';
  bio                     : LargeString @title: 'Bio' @UI.MultiLineText;

  // Determined by the service when a candidate launches (Task 3 @Before handler).
  // @readonly: any client input for these elements is ignored.
  callSign                : String(30) @readonly @title: 'Call Sign';
  launchedAt              : Timestamp  @readonly @title: 'Launched At';
  onboardingBonus         : Integer default 0 @readonly @title: 'Onboarding Bonus';
  wormholeCertification   : String(20) @readonly @title: 'Wormhole Certification';

  // Calculated on read, so they can be filtered and sorted server-side.
  @title: 'Stardust Status'
  stardustStatus          : String(20) = case
                              when stardustCollection >= 10000 then 'Legendary'
                              when stardustCollection >= 1000  then 'Thriving'
                              when stardustCollection >= 100   then 'Collecting'
                              else 'Depleted'
                            end;
  // UI.CriticalityType: 1 negative (red), 2 critical (orange), 3 positive (green), 5 information (blue)
  @title: 'Stardust Criticality'
  stardustCriticality     : Integer = case
                              when stardustCollection >= 10000 then 5
                              when stardustCollection >= 1000  then 3
                              when stardustCollection >= 100   then 2
                              else 1
                            end;
}
