import cds from '@sap/cds'
const { GET, POST, PATCH, expect, data } = cds.test(import.meta.dirname + '/..')
beforeEach(data.reset)

import { BASE, asXavier, asZed, throwing, asODataError, asSpacefarerCollection } from './helpers.ts'

// The handlers raise errors by key; the English text lives in _i18n/messages.properties and only
// reaches the client once CAP resolves the key against that bundle. An unresolvable key is not an
// error for CAP — it passes the key through as the message — and every other assertion in this
// suite checks only `target`. Without the assertions below, a renamed key, a bundle that stops
// being packaged, or a lost `args` array would leave the whole suite green while users are shown
// `ORIGIN_PLANET_FORBIDDEN`. These tests fail on exactly that.

const CHIEF_NAVIGATOR = 'b0000000-0000-4000-8000-000000000003' // 'Chief Navigator', minimum skill 9
const NAVIGATOR_CADET = 'b0000000-0000-4000-8000-000000000001' // 'Navigator Cadet', wormhole nav dept
const STARDUST_MINING_DEPT = 'd0000000-0000-4000-8000-000000000002'
const EXISTING_X_EMAIL = 'aria.voss@galactic.example'

const candidate = () => ({
  IsActiveEntity: true,
  name: 'Message Probe',
  email: `probe.${Math.random().toString(36).slice(2)}@example.com`,
  spacesuitColor_code: 'RED',
})

const messageOf = (res: { data: unknown }) => asODataError(res).error.message

describe('i18n: service error messages resolve from the text bundle', () => {
  it('resolves ORIGIN_PLANET_FORBIDDEN, interpolating the rejected planet code', async () => {
    const res = await POST(`${BASE}/Spacefarers`, { ...candidate(), originPlanet_code: 'Y' }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(403)
    expect(messageOf(res)).to.equal("Cosmic invader alert: you may not assign spacefarers to planet 'Y'")
  })

  it('resolves ORIGIN_PLANET_REQUIRED', async () => {
    const res = await POST(`${BASE}/Spacefarers`, candidate(), { ...asZed, ...throwing })
    expect(res.status).to.equal(400)
    expect(messageOf(res)).to.equal('Provide the origin planet')
  })

  it('resolves EMAIL_ALREADY_REGISTERED', async () => {
    const res = await POST(`${BASE}/Spacefarers`, { ...candidate(), email: EXISTING_X_EMAIL }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)
    expect(messageOf(res)).to.equal('This email address is already registered with another spacefarer')
  })

  it('resolves POSITION_SKILL_TOO_LOW, interpolating the position title and the required skill', async () => {
    const res = await POST(
      `${BASE}/Spacefarers`,
      { ...candidate(), wormholeNavigationSkill: 2, position_ID: CHIEF_NAVIGATOR },
      { ...asXavier, ...throwing },
    )
    expect(res.status).to.equal(400)
    expect(messageOf(res)).to.equal("Position 'Chief Navigator' requires a wormhole navigation skill of 9 or higher")
  })

  it('resolves POSITION_DEPARTMENT_MISMATCH, interpolating the position title', async () => {
    const res = await POST(
      `${BASE}/Spacefarers`,
      { ...candidate(), wormholeNavigationSkill: 5, position_ID: NAVIGATOR_CADET, department_ID: STARDUST_MINING_DEPT },
      { ...asXavier, ...throwing },
    )
    expect(res.status).to.equal(400)
    expect(messageOf(res)).to.equal("Position 'Navigator Cadet' belongs to a different department")
  })

  it('resolves ORIGIN_PLANET_IMMUTABLE', async () => {
    const row = asSpacefarerCollection(await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'X'&$top=1`, asXavier)).value[0]
    const res = await PATCH(
      `${BASE}/Spacefarers(ID=${row!.ID},IsActiveEntity=true)`,
      { originPlanet_code: 'ZOG' },
      { ...asZed, ...throwing },
    )
    expect(res.status).to.equal(400)
    expect(messageOf(res)).to.equal('The origin planet of a spacefarer cannot be changed')
  })
})

describe('i18n: model labels resolve in $metadata', () => {
  it('serves resolved label text, not raw {i18n>...} keys', async () => {
    const res = await GET(`${BASE}/$metadata`, asXavier)
    const xml = res.data as string
    expect(xml).to.contain('Stardust Status')
    expect(xml).to.contain('Wormhole Navigation Skill')
    expect(xml).to.not.contain('{i18n>')
  })
})
