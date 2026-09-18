namespace galactic;

using { cuid, managed, sap.common.CodeList } from '@sap/cds/common';

/**
 * Planets of the SAP galaxy.
 * `code` doubles as the tenancy key: users carry a `planet` attribute and only ever see
 * spacefarers whose origin planet matches it (see SpacefarerService).
 */
@cds.odata.valuelist
entity Planets : CodeList {
  key code        : String(10) @title: '{i18n>Planet}';
      galaxy      : String(60) @title: '{i18n>Galaxy}';
      hazardLevel : Integer    @title: '{i18n>HazardLevel}' @assert.range: [1, 5];
}

/** Regulation spacesuit colors, maintained as a code list so Fiori renders a value help. */
@cds.odata.valuelist
entity SpacesuitColors : CodeList {
  key code : String(10) @title: '{i18n>SpacesuitColor}';
      hex  : String(7)  @title: '{i18n>HexValue}';
}

/** Intergalactic departments a spacefarer can belong to. */
@cds.odata.valuelist
entity Departments : cuid, managed {
  name         : String(100) @mandatory @title: '{i18n>Department}';
  description  : String(500) @title: '{i18n>Description}';
  headquarters : Association to Planets @title: '{i18n>Headquarters}';
  positions    : Association to many Positions on positions.department = $self;
  spacefarers  : Association to many Spacefarers on spacefarers.department = $self;
}

/** Positions within a department, each demanding a minimum wormhole navigation skill. */
@cds.odata.valuelist
entity Positions : cuid {
  title            : String(100) @mandatory @title: '{i18n>Position}';
  rank             : Integer @title: '{i18n>Rank}' @assert.range: [1, 10];
  minWormholeSkill : Integer default 1 @title: '{i18n>MinWormholeSkill}' @assert.range: [1, 10];
  department       : Association to Departments @title: '{i18n>Department}';
}

/** A spacefarer on their journey through the SAP galaxy. */
@assert.unique: { email: [email] }
entity Spacefarers : cuid, managed {
  name                    : String(100) @mandatory @title: '{i18n>Name}';
  email                   : String(255) @mandatory @title: '{i18n>Email}'
                            @assert.format: '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  stardustCollection      : Integer default 0 @title: '{i18n>StardustCollection}' @assert.range: [0, 1000000];
  wormholeNavigationSkill : Integer default 1 @title: '{i18n>WormholeNavigationSkill}' @assert.range: [1, 10];
  // Required, but defaulted from the user's planet attribute by the service (see srv/spacefarer-service.js),
  // hence enforced there instead of via @mandatory (which would run before the default is applied).
  originPlanet            : Association to Planets @assert.target @title: '{i18n>OriginPlanet}';
  spacesuitColor          : Association to SpacesuitColors @mandatory @assert.target @title: '{i18n>SpacesuitColor}';
  department              : Association to Departments @assert.target @title: '{i18n>Department}';
  position                : Association to Positions @assert.target @title: '{i18n>Position}';
  bio                     : LargeString @title: '{i18n>Bio}' @UI.MultiLineText;

  // Determined by the service when a candidate launches (Task 3 @Before handler).
  // @readonly: any client input for these elements is ignored.
  callSign                : String(30) @readonly @title: '{i18n>CallSign}';
  launchedAt              : Timestamp  @readonly @title: '{i18n>LaunchedAt}';
  onboardingBonus         : Integer default 0 @readonly @title: '{i18n>OnboardingBonus}';
  wormholeCertification   : String(20) @readonly @title: '{i18n>WormholeCertification}';

  // Calculated on read, so they can be filtered and sorted server-side.
  @title: '{i18n>StardustStatus}'
  stardustStatus          : String(20) = case
                              when stardustCollection >= 10000 then 'Legendary'
                              when stardustCollection >= 1000  then 'Thriving'
                              when stardustCollection >= 100   then 'Collecting'
                              else 'Depleted'
                            end;
  // UI.CriticalityType: 1 negative (red), 2 critical (orange), 3 positive (green), 5 information (blue)
  @title: '{i18n>StardustCriticality}'
  stardustCriticality     : Integer = case
                              when stardustCollection >= 10000 then 5
                              when stardustCollection >= 1000  then 3
                              when stardustCollection >= 100   then 2
                              else 1
                            end;
  // Colours the certification in the list. Deliberately never 1 (negative/red): a Cadet is at
  // the start of a career, not in an error state, so the bands read as information -> critical
  // -> positive rather than as a pass/fail.
  @title: '{i18n>CertificationCriticality}'
  certificationCriticality : Integer = case
                              when wormholeNavigationSkill >= 8 then 3
                              when wormholeNavigationSkill >= 4 then 2
                              else 5
                            end;
}
