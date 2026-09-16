import cds from '@sap/cds'
const { GET, POST, PATCH, DELETE, expect, data } = cds.test(import.meta.dirname + '/..')
beforeEach(data.reset)

const BASE = '/odata/v4/spacefarers'
const asXavier = { auth: { username: 'xavier', password: 'planetx' } }
const asZed = { auth: { username: 'zed', password: 'galaxy' } }
const throwing = { validateStatus: () => true }

const NAVIGATOR_CADET = 'b0000000-0000-4000-8000-000000000001' // dept d001, min skill 1
const CHIEF_NAVIGATOR = 'b0000000-0000-4000-8000-000000000003' // dept d001, min skill 9
const MINING_FOREMAN = 'b0000000-0000-4000-8000-000000000005' // dept d002, min skill 3
const WORMHOLE_NAV_DEPT = 'd0000000-0000-4000-8000-000000000001'
const STARDUST_MINING_DEPT = 'd0000000-0000-4000-8000-000000000002'
const EXISTING_X_EMAIL = 'aria.voss@galactic.example'

describe('create: validation and enhancement (Task 3 before-CREATE)', () => {
  it('creates an active spacefarer for xavier, defaults the planet, applies the bonus and ignores readonly input', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {
      IsActiveEntity: true,
      name: 'Tara Pike',
      email: 'tara.pike@example.com',
      stardustCollection: 50,
      wormholeNavigationSkill: 3,
      spacesuitColor_code: 'RED',
      callSign: 'HACKED',
    }, asXavier)

    expect(res.status).to.equal(201)
    expect(res.data.originPlanet_code).to.equal('X')
    expect(res.data.stardustCollection).to.equal(150)
    expect(res.data.onboardingBonus).to.equal(100)
    expect(res.data.wormholeNavigationSkill).to.equal(3)
    expect(res.data.wormholeCertification).to.equal('Cadet')
    expect(res.data.callSign).to.match(/^X-TP-[0-9A-F]{4}$/)
    expect(res.data.callSign).to.not.equal('HACKED')
    expect(res.data.launchedAt).to.be.a('string').and.not.empty
    expect(res.data.stardustStatus).to.equal('Collecting')
    expect(res.data.stardustCriticality).to.equal(2)
  })

  it('rejects xavier assigning a spacefarer to another planet, targeting originPlanet_code', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {
      IsActiveEntity: true,
      name: 'Someone Else',
      email: 'someone.else@example.com',
      spacesuitColor_code: 'RED',
      originPlanet_code: 'Y',
    }, { ...asXavier, ...throwing })

    expect(res.status).to.equal(403)
    expect(res.data.error.target).to.equal('originPlanet_code')
  })

  it('rejects zed (no planet attribute) creating without an explicit origin planet, targeting originPlanet_code', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {
      IsActiveEntity: true,
      name: 'No Planet',
      email: 'no.planet@example.com',
      spacesuitColor_code: 'RED',
    }, { ...asZed, ...throwing })

    expect(res.status).to.equal(400)
    expect(res.data.error.target).to.equal('originPlanet_code')
  })

  it('lets zed create on any planet, applying the hazard bonus/skill bump and deriving the department from the position', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {
      IsActiveEntity: true,
      name: 'Zog Miner',
      email: 'zog.miner@example.com',
      spacesuitColor_code: 'BLACK',
      originPlanet_code: 'ZOG',
      wormholeNavigationSkill: 7,
      position_ID: MINING_FOREMAN,
    }, asZed)

    expect(res.status).to.equal(201)
    expect(res.data.stardustCollection).to.equal(150)
    expect(res.data.wormholeNavigationSkill).to.equal(8)
    expect(res.data.wormholeCertification).to.equal('Master')
    expect(res.data.department_ID).to.equal(STARDUST_MINING_DEPT)
  })

  const basePayload = () => ({
    IsActiveEntity: true,
    name: 'Valid Candidate',
    email: `valid.${Math.random().toString(36).slice(2)}@example.com`,
    spacesuitColor_code: 'RED',
  })

  it('rejects a wormhole navigation skill above the maximum (11) with 400', async () => {
    const res = await POST(`${BASE}/Spacefarers`, { ...basePayload(), wormholeNavigationSkill: 11 }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)
  })

  it('rejects a wormhole navigation skill below the minimum (0) with 400', async () => {
    const res = await POST(`${BASE}/Spacefarers`, { ...basePayload(), wormholeNavigationSkill: 0 }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)
  })

  it('rejects a negative stardust collection with 400', async () => {
    const res = await POST(`${BASE}/Spacefarers`, { ...basePayload(), stardustCollection: -1 }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)
  })

  it('rejects a malformed email with 400', async () => {
    const res = await POST(`${BASE}/Spacefarers`, { ...basePayload(), email: 'not-an-email' }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)
  })

  // @assert.unique only materialises as a database index; without the explicit pre-check in
  // srv/spacefarer-service.js a duplicate would surface as a raw SQLite constraint error (500).
  it('rejects a duplicate email (already used by a seeded spacefarer) with 400', async () => {
    const res = await POST(`${BASE}/Spacefarers`, { ...basePayload(), email: EXISTING_X_EMAIL }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)
    expect(res.data.error.target).to.equal('email')
  })

  it('rejects a skill below the position minimum, targeting wormholeNavigationSkill', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {
      ...basePayload(),
      wormholeNavigationSkill: 2,
      position_ID: CHIEF_NAVIGATOR, // requires 9
    }, { ...asXavier, ...throwing })

    expect(res.status).to.equal(400)
    expect(res.data.error.target).to.equal('wormholeNavigationSkill')
  })

  it('rejects a position/department mismatch, targeting position_ID', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {
      ...basePayload(),
      wormholeNavigationSkill: 5,
      position_ID: NAVIGATOR_CADET, // belongs to WORMHOLE_NAV_DEPT
      department_ID: STARDUST_MINING_DEPT,
    }, { ...asXavier, ...throwing })

    expect(res.status).to.equal(400)
    expect(res.data.error.target).to.equal('position_ID')
    expect(WORMHOLE_NAV_DEPT).to.not.equal(STARDUST_MINING_DEPT)
  })
})

describe('create: server-side paging and calculated elements', () => {
  it('supports $filter on the calculated stardustStatus element', async () => {
    const res = await GET(`${BASE}/Spacefarers?$filter=stardustStatus eq 'Legendary'&$top=100`, asZed)
    expect(res.data.value.length).to.be.greaterThan(0)
    for (const row of res.data.value) expect(row.stardustCollection).to.be.at.least(10000)
  })

  it('supports $orderby on stardustCollection descending', async () => {
    const res = await GET(`${BASE}/Spacefarers?$orderby=stardustCollection desc&$top=10`, asZed)
    const values = res.data.value.map(r => r.stardustCollection)
    const sorted = [...values].sort((a, b) => b - a)
    expect(values).to.deep.equal(sorted)
  })

  it('caps the admin listing at the default page size of 20 with a nextLink', async () => {
    const res = await GET(`${BASE}/Spacefarers`, asZed)
    expect(res.data.value.length).to.equal(20)
    expect(res.data['@odata.nextLink']).to.be.a('string')
  })
})

describe('update: re-validation and planet immutability on existing spacefarers', () => {
  const xRow = async () => (await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'X'&$top=1`, asXavier)).data.value[0]

  it('recomputes wormholeCertification when the skill is updated', async () => {
    const row = await xRow()
    const res = await PATCH(`${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`, { wormholeNavigationSkill: 9 }, asXavier)
    expect(res.status).to.equal(200)
    expect(res.data.wormholeCertification).to.equal('Master')
  })

  it('re-validates the position against the (possibly unchanged) skill on update', async () => {
    // Pick a row whose current skill is low enough to fail Chief Navigator's minimum of 9.
    const list = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'X' and wormholeNavigationSkill lt 9&$top=1`, asXavier)
    const row = list.data.value[0]
    const res = await PATCH(
      `${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`,
      { position_ID: CHIEF_NAVIGATOR },
      { ...asXavier, ...throwing },
    )
    expect(res.status).to.equal(400)
    expect(res.data.error.target).to.equal('wormholeNavigationSkill')
  })

  it('rejects changing the origin planet of an existing spacefarer with 400, even for an admin', async () => {
    const row = await xRow()
    const res = await PATCH(
      `${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`,
      { originPlanet_code: 'ZOG' },
      { ...asZed, ...throwing },
    )
    expect(res.status).to.equal(400)
    expect(res.data.error.target).to.equal('originPlanet_code')

    const after = await GET(`${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`, asXavier)
    expect(after.data.originPlanet_code).to.equal('X')
  })

  it('treats PATCHing the planet to its current value as a no-op (allowed)', async () => {
    const row = await xRow()
    const res = await PATCH(`${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`, { originPlanet_code: 'X' }, asXavier)
    expect(res.status).to.equal(200)
    expect(res.data.originPlanet_code).to.equal('X')
  })
})

describe('delete', () => {
  it('lets xavier delete one of his own (X) spacefarers with 204', async () => {
    const list = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'X'&$top=1`, asXavier)
    const row = list.data.value[0]
    const res = await DELETE(`${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`, asXavier)
    expect(res.status).to.equal(204)
  })

  it('rejects xavier deleting a Y spacefarer with 403 or 404', async () => {
    const asYvonne = { auth: { username: 'yvonne', password: 'planety' } }
    const list = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'Y'&$top=1`, asYvonne)
    const row = list.data.value[0]
    const res = await DELETE(`${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`, { ...asXavier, ...throwing })
    expect(res.status).to.be.oneOf([403, 404])
  })
})
