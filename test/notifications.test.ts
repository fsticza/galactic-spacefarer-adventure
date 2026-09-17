import cds from '@sap/cds'
const { POST, expect, data } = cds.test(import.meta.dirname + '/..')
beforeEach(data.reset)

import { BASE, asXavier, throwing, asSpacefarerRow } from './helpers.ts'
import type { Message } from '#cds-models/cds/outbox'

/** The shape of a mail recorded by the fake transporter used in these tests. */
interface RecordedMail {
  to: string
  subject: string
  text: string
}

/** The subset of NotificationService's shape these tests need: a swappable mail transporter. */
interface TransporterLike {
  sendMail: (mail: RecordedMail) => Promise<{ messageId: string }>
}
interface NotificationServiceLike {
  transporter: TransporterLike
}

/** cds.flush() exists at runtime on newer @sap/cds versions but isn't declared in the shipped types. */
type CdsWithFlush = typeof cds & { flush?: () => Promise<void> }

let notif: NotificationServiceLike
let sent: RecordedMail[]

beforeEach(async () => {
  notif = (await cds.connect.to('NotificationService')) as unknown as NotificationServiceLike
  sent = []
  notif.transporter = { sendMail: async mail => { sent.push(mail); return { messageId: 'test' } } }
})

/** Waits for the transactional outbox to drain, however cds.flush() is (or isn't) implemented. */
async function flushOutbox() {
  const cdsWithFlush = cds as CdsWithFlush
  if (typeof cdsWithFlush.flush === 'function') return cdsWithFlush.flush()
  const start = Date.now()
  while (Date.now() - start < 5000) {
    const rows = (await SELECT.from('cds.outbox.Messages')) as Message[]
    if (rows.length === 0) return
    await new Promise(r => setTimeout(r, 100))
  }
}

describe('notifications: welcome email on successful launch', () => {
  it('sends exactly one welcome mail after a successful create, and drains the outbox', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {
      IsActiveEntity: true,
      name: 'Nova Quill',
      email: 'nova.quill@example.com',
      spacesuitColor_code: 'RED',
    }, asXavier)
    expect(res.status).to.equal(201)

    await flushOutbox()

    expect(sent).to.have.lengthOf(1)
    expect(sent[0].to).to.equal('nova.quill@example.com')
    expect(sent[0].subject).to.contain('Welcome aboard')
    expect(sent[0].text).to.contain(asSpacefarerRow(res).callSign)

    const remaining = (await SELECT.from('cds.outbox.Messages')) as Message[]
    expect(remaining).to.have.lengthOf(0)
  })

  it('sends nothing and leaves the outbox empty when the create is rejected (400)', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {
      IsActiveEntity: true,
      name: 'Bad Candidate',
      email: 'not-an-email',
      spacesuitColor_code: 'RED',
    }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)

    await flushOutbox()

    expect(sent).to.have.lengthOf(0)
    const remaining = (await SELECT.from('cds.outbox.Messages')) as Message[]
    expect(remaining).to.have.lengthOf(0)
  })

  it('keeps a failed delivery queued with attempts >= 1 when the transport throws', async () => {
    notif.transporter = {
      sendMail: async () => { throw new Error('SMTP is down') },
    }

    const res = await POST(`${BASE}/Spacefarers`, {
      IsActiveEntity: true,
      name: 'Retry Candidate',
      email: 'retry.candidate@example.com',
      spacesuitColor_code: 'RED',
    }, asXavier)
    expect(res.status).to.equal(201)

    await flushOutbox()

    expect(sent).to.have.lengthOf(0)
    const remaining = (await SELECT.from('cds.outbox.Messages')) as Message[]
    expect(remaining).to.have.lengthOf(1)
    expect(remaining[0].attempts).to.be.at.least(1)

    // restore a working transporter so afterEach/beforeEach in later tests are unaffected
    notif.transporter = { sendMail: async mail => { sent.push(mail); return { messageId: 'test' } } }
  })
})
