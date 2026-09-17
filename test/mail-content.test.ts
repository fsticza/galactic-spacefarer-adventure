import { composeWelcomeMail } from '../srv/notification-service.ts'
import type { SpacefarerLaunched } from '#cds-models/SpacefarerService'

// Pure unit tests: composeWelcomeMail is plain string templating with no CAP server dependency.

const BRIEFING: SpacefarerLaunched = {
  ID: 'briefing-1',
  name: 'Aria Voss',
  email: 'aria.voss@example.com',
  callSign: 'X-AV-8000',
  originPlanet: 'Xylara',
  stardustCollection: 150,
  wormholeNavigationSkill: 7,
  wormholeCertification: 'Navigator',
  launchedAt: '2026-09-16T00:00:00.000Z',
}

describe('composeWelcomeMail', () => {
  it('includes the spacefarer name in the subject', () => {
    const mail = composeWelcomeMail(BRIEFING)
    expect(mail.subject).to.contain('Aria Voss')
  })

  it('includes call sign, origin planet, stardust collection, skill, certification and launchedAt in the plain-text body', () => {
    const mail = composeWelcomeMail(BRIEFING)
    expect(mail.text).to.contain('X-AV-8000')
    expect(mail.text).to.contain('Xylara')
    expect(mail.text).to.contain('150')
    expect(mail.text).to.contain('7/10')
    expect(mail.text).to.contain('Navigator')
    expect(mail.text).to.contain('2026-09-16T00:00:00.000Z')
  })

  it('sets `to` to the spacefarer email', () => {
    const mail = composeWelcomeMail(BRIEFING)
    expect(mail.to).to.equal('aria.voss@example.com')
  })

  it('leaves `to` undefined when the email is null', () => {
    const mail = composeWelcomeMail({ ...BRIEFING, email: null })
    expect(mail.to).to.equal(undefined)
  })

  it('leaves `to` undefined when the email is missing entirely', () => {
    const { email, ...withoutEmail } = BRIEFING
    void email
    const mail = composeWelcomeMail(withoutEmail as SpacefarerLaunched)
    expect(mail.to).to.equal(undefined)
  })

  it('defaults `from` to mission-control@galactic.example', () => {
    const mail = composeWelcomeMail(BRIEFING)
    expect(mail.from).to.equal('mission-control@galactic.example')
  })

  it('uses the second argument to override `from`', () => {
    const mail = composeWelcomeMail(BRIEFING, 'captain@galactic.example')
    expect(mail.from).to.equal('captain@galactic.example')
  })

  describe('HTML escaping', () => {
    // A single name carrying a script tag plus every character the escaper handles
    // (& " '), so one field exercises the whole entity table.
    const maliciousName = `<script>alert(1)</script> & "quoted" 'single'`
    const malicious: SpacefarerLaunched = { ...BRIEFING, name: maliciousName }

    it('escapes HTML-significant characters in the html part', () => {
      const mail = composeWelcomeMail(malicious)
      expect(mail.html).to.contain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(mail.html).to.contain('&amp;')
      expect(mail.html).to.contain('&quot;')
      expect(mail.html).to.contain('&#39;')
      expect(mail.html).to.not.contain('<script>')
    })

    it('does not escape the plain-text part (current behaviour)', () => {
      const mail = composeWelcomeMail(malicious)
      expect(mail.text).to.contain(maliciousName)
    })
  })
})
