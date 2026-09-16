import cds from '@sap/cds'
import nodemailer from 'nodemailer'

const LOG = cds.log('notifications')

/**
 * Sends the cosmic congratulation email.
 *
 * Flow: SpacefarerService emits `SpacefarerLaunched` inside the launching transaction. The
 * subscription below only *queues* `deliverWelcomeMail` on this service (persisted in the same
 * transaction). After commit the queue runner dispatches it and the mail is sent; if the
 * transport throws, the message stays queued and is retried.
 */
export class NotificationService extends cds.ApplicationService {
  init() {
    this.transporter = createTransporter(cds.env.mail ?? {})

    cds.on('served', async () => {
      const spacefarers = await cds.connect.to('SpacefarerService')
      spacefarers.on('SpacefarerLaunched', msg => cds.queued(this).send('deliverWelcomeMail', { briefing: msg.data }))
    })

    this.on('deliverWelcomeMail', async req => {
      const { briefing } = req.data
      const info = await this.transporter.sendMail(composeWelcomeMail(briefing, cds.env.mail?.from))
      LOG.info(`Cosmic welcome sent to ${briefing.email} (${briefing.callSign})`)
      if (info.message) LOG.debug('Rendered mail:', String(info.message))
    })

    return super.init()
  }
}

/** Builds the congratulation mail for a freshly launched spacefarer. */
export function composeWelcomeMail(s, from = 'mission-control@galactic.example') {
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
  return { from, to: s.email, subject, text, html }
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Transport selection: SMTP when `SMTP_URL` is set (or `MAIL_TRANSPORT=smtp` / `cds.mail.transport`
 * is `smtp`), otherwise nodemailer's JSON transport, which renders the mail without any network access.
 */
function createTransporter(config) {
  const url = process.env.SMTP_URL ?? config.url
  const transport = process.env.MAIL_TRANSPORT ?? (url ? 'smtp' : config.transport) ?? 'json'
  if (transport === 'smtp') {
    if (!url) throw new Error('SMTP transport selected but no SMTP_URL configured')
    LOG.info('Using SMTP transport')
    return nodemailer.createTransport(url)
  }
  LOG.info('Using JSON transport (mails are rendered and logged, not delivered)')
  return nodemailer.createTransport({ jsonTransport: true })
}
