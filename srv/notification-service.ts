import cds from '@sap/cds'
import nodemailer, { type Transporter } from 'nodemailer'
import type { SpacefarerLaunched } from '#cds-models/SpacefarerService'

// `@sap/cds` also publishes itself as `global.cds`. When this module is dynamically imported
// concurrently with a sibling service module (both loaded as native ESM/TS by `cds serve`), the
// default import above can resolve to an empty placeholder that Node hands out before the
// `@sap/cds` CommonJS module has actually finished evaluating. `global.cds` is assigned
// synchronously inside that module and is always the fully-initialized singleton by the time a
// service's `init()` runs, so the runtime facade is read from there, falling back to the plain
// import (e.g. under test runners that don't exhibit the race). Type positions (`cds.Request`,
// ...) keep referring to the static import, which is resolved at compile time and is unaffected
// by which object the import binds to at runtime.
const facade: typeof cds = (globalThis as { cds?: typeof cds }).cds ?? cds

/**
 * Sends the cosmic congratulation email.
 *
 * Flow: SpacefarerService emits `SpacefarerLaunched` inside the launching transaction. The
 * subscription below only *queues* `deliverWelcomeMail` on this service (persisted in the same
 * transaction). After commit the queue runner dispatches it and the mail is sent; if the
 * transport throws, the message stays queued and is retried.
 */
export class NotificationService extends facade.ApplicationService {
  declare transporter: Transporter

  override init() {
    // `cds.log` is only populated once the runtime has bootstrapped, so it is read here rather
    // than at module scope (a module-scope access crashes the server at load).
    const LOG = facade.log('notifications')
    this.transporter = createTransporter(facade.env.mail ?? {}, LOG)

    facade.on('served', async () => {
      const spacefarers = await facade.connect.to('SpacefarerService')
      spacefarers.on('SpacefarerLaunched', (msg: cds.Request) => facade.queued(this).send('deliverWelcomeMail', { briefing: msg.data as SpacefarerLaunched }))
    })

    this.on('deliverWelcomeMail', async (req: cds.Request) => {
      const { briefing } = req.data as { briefing: SpacefarerLaunched }
      const info = await this.transporter.sendMail(composeWelcomeMail(briefing, facade.env.mail?.from))
      LOG.info(`Cosmic welcome sent to ${briefing.email} (${briefing.callSign})`)
      if (info.message) LOG.debug('Rendered mail:', String(info.message))
    })

    return super.init()
  }
}

/** Builds the congratulation mail for a freshly launched spacefarer. */
export function composeWelcomeMail(s: SpacefarerLaunched, from = 'mission-control@galactic.example') {
  const subject = `Welcome aboard, ${s.name}! Your cosmic journey begins`
  const text = [
    `Dear ${s.name},`,
    '',
    'Congratulations! You have officially embarked on your adventurous journey among the stars.',
    '',
    `Call sign:                  ${s.callSign}`,
    `Origin planet:              ${s.originPlanet}`,
    `Stardust collection:        ${s.stardustCollection} (onboarding bonus included)`,
    `Wormhole navigation skill:  ${s.wormholeNavigationSkill}/10 (${s.wormholeCertification})`,
    `Launched at:                ${s.launchedAt}`,
    '',
    'May your wormholes be short and your stardust plentiful.',
    '',
    'Galactic Mission Control',
  ].join('\n')
  const html = `<p>Dear ${escape(s.name)},</p>
<p>Congratulations! You have officially embarked on your adventurous journey among the stars.</p>
<ul>
  <li><b>Call sign:</b> ${escape(s.callSign)}</li>
  <li><b>Origin planet:</b> ${escape(s.originPlanet)}</li>
  <li><b>Stardust collection:</b> ${s.stardustCollection} (onboarding bonus included)</li>
  <li><b>Wormhole navigation skill:</b> ${s.wormholeNavigationSkill}/10 (${escape(s.wormholeCertification)})</li>
  <li><b>Launched at:</b> ${escape(s.launchedAt)}</li>
</ul>
<p>May your wormholes be short and your stardust plentiful.</p>
<p>Galactic Mission Control</p>`
  return { from, to: s.email ?? undefined, subject, text, html }
}

const escape = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c])

/**
 * Transport selection: SMTP when `SMTP_URL` is set (or `MAIL_TRANSPORT=smtp` / `cds.mail.transport`
 * is `smtp`), otherwise nodemailer's JSON transport, which renders the mail without any network access.
 */
function createTransporter(config: { url?: string; transport?: string }, log: ReturnType<typeof cds.log>): Transporter {
  const url = process.env.SMTP_URL ?? config.url
  const transport = process.env.MAIL_TRANSPORT ?? (url ? 'smtp' : config.transport) ?? 'json'
  if (transport === 'smtp') {
    if (!url) throw new Error('SMTP transport selected but no SMTP_URL configured')
    log.info('Using SMTP transport')
    return nodemailer.createTransport(url)
  }
  log.info('Using JSON transport (mails are rendered and logged, not delivered)')
  return nodemailer.createTransport({ jsonTransport: true })
}
