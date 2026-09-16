import cds from '@sap/cds'
const { POST, expect, data } = cds.test(import.meta.dirname + '/..')
beforeEach(data.reset)

const BASE = '/odata/v4/spacefarers'
const asXavier = { auth: { username: 'xavier', password: 'planetx' } }
const throwing = { validateStatus: () => true }

let notif
let sent

beforeEach(async () => {
  notif = await cds.connect.to('NotificationService')
  sent = []
  notif.transporter = { sendMail: async mail => { sent.push(mail); return { messageId: 'test' } } }
})

/** Waits for the transactional outbox to drain, however cds.flush() is (or isn't) implemented. */
async function flushOutbox() {
  if (typeof cds.flush === 'function') return cds.flush()
  const start = Date.now()
  while (Date.now() - start < 5000) {
    const rows = await SELECT.from('cds.outbox.Messages')
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
    expect(sent[0].text).to.contain(res.data.callSign)

    const remaining = await SELECT.from('cds.outbox.Messages')
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
    const remaining = await SELECT.from('cds.outbox.Messages')
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
    const remaining = await SELECT.from('cds.outbox.Messages')
    expect(remaining).to.have.lengthOf(1)
    expect(remaining[0].attempts).to.be.at.least(1)

    // restore a working transporter so afterEach/beforeEach in later tests are unaffected
    notif.transporter = { sendMail: async mail => { sent.push(mail); return { messageId: 'test' } } }
  })
})
