/** Payload of the cosmic launch event raised by SpacefarerService. */
type CosmicLaunchBriefing {
  ID                      : UUID;
  name                    : String(100);
  email                   : String(255);
  callSign                : String(30);
  originPlanet            : String(10);
  stardustCollection      : Integer;
  wormholeNavigationSkill : Integer;
  wormholeCertification   : String(20);
  launchedAt              : Timestamp;
}

/**
 * Internal cosmic notification service, not exposed over HTTP.
 * It subscribes to SpacefarerService.SpacefarerLaunched and relays each launch into its own
 * transactional queue, so the congratulation email leaves mission control only after the
 * launching transaction has been committed (and is retried if the mail transport fails).
 */
@protocol: 'none'
service NotificationService {
  /** Queued delivery of the congratulation email. */
  action deliverWelcomeMail(briefing : CosmicLaunchBriefing);
}
