using { galactic as db } from '../db/schema';
using { CosmicLaunchBriefing } from './notification-service';

/**
 * Galactic Spacefarer Service, protected from cosmic invaders:
 *  - every request needs an authenticated user holding one of the galactic roles,
 *  - Viewers and Managers only see and touch spacefarers of their own planet ($user.planet),
 *  - Galactic Admins roam the whole galaxy.
 * Reference data (planets, colors, departments, positions) is a shared galactic catalog.
 */
@path: 'spacefarers'
@requires: ['SpacefarerViewer', 'SpacefarerManager', 'GalacticAdmin']
@cds.query.limit: { default: 20, max: 100 }
service SpacefarerService {

  @odata.draft.enabled
  @restrict: [
    { grant: 'READ', to: 'SpacefarerViewer',  where: (originPlanet.code = $user.planet) },
    { grant: '*',    to: 'SpacefarerManager', where: (originPlanet.code = $user.planet) },
    { grant: '*',    to: 'GalacticAdmin' }
  ]
  entity Spacefarers as projection on db.Spacefarers;

  @readonly entity Planets         as projection on db.Planets;
  @readonly entity SpacesuitColors as projection on db.SpacesuitColors;
  @readonly entity Departments     as projection on db.Departments;
  @readonly entity Positions       as projection on db.Positions;

  /**
   * Cosmic custom event, emitted once a new spacefaring candidate has successfully launched.
   * The NotificationService subscribes to it to send the congratulation email.
   */
  event SpacefarerLaunched : CosmicLaunchBriefing;
}

// The origin planet is fixed once a candidate has launched. This is enforced in the service
// implementation rather than via @Core.Immutable, because the cds 10 runtime cleanses immutable
// fields from every draft PATCH, including the create dialog's own draft.
