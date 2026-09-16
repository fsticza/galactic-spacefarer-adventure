import cds from '@sap/cds'
const { GET, PATCH, expect, data } = cds.test(import.meta.dirname + '/..')
beforeEach(data.reset)

const BASE = '/odata/v4/spacefarers'
const asXavier = { auth: { username: 'xavier', password: 'planetx' } }
const asYvonne = { auth: { username: 'yvonne', password: 'planety' } }
const asVera = { auth: { username: 'vera', password: 'vera' } }
const asZed = { auth: { username: 'zed', password: 'galaxy' } }
const asNobody = { auth: { username: 'nobody', password: 'nobody' } }

describe('authentication', () => {
  it('rejects a request without credentials with 401', async () => {
    const res = await GET(`${BASE}/Spacefarers`, { validateStatus: () => true })
    expect(res.status).to.equal(401)
  })
})

describe('authorization', () => {
  it('rejects an authenticated user with no galactic role with 403', async () => {
    const res = await GET(`${BASE}/Spacefarers`, { ...asNobody, validateStatus: () => true })
    expect(res.status).to.equal(403)
  })

  it('scopes xavier (SpacefarerManager on X) to planet X, count 24', async () => {
    const res = await GET(`${BASE}/Spacefarers?$count=true`, asXavier)
    expect(res.data['@odata.count']).to.equal(24)
    expect(res.data.value.length).to.be.greaterThan(0)
    expect(res.data.value.every(r => r.originPlanet_code === 'X')).to.equal(true)
  })

  it('scopes yvonne (SpacefarerManager on Y) to planet Y, count 20', async () => {
    const res = await GET(`${BASE}/Spacefarers?$count=true`, asYvonne)
    expect(res.data['@odata.count']).to.equal(20)
    expect(res.data.value.every(r => r.originPlanet_code === 'Y')).to.equal(true)
  })

  it('lets zed (GalacticAdmin) see all 60 rows via $count, paged at 20 with a nextLink', async () => {
    const counted = await GET(`${BASE}/Spacefarers?$count=true`, asZed)
    expect(counted.data['@odata.count']).to.equal(60)

    const plain = await GET(`${BASE}/Spacefarers`, asZed)
    expect(plain.data.value.length).to.equal(20)
    expect(plain.data['@odata.nextLink']).to.be.a('string')
  })

  it('returns Planets (global reference data) for every role', async () => {
    for (const auth of [asXavier, asVera, asZed]) {
      const res = await GET(`${BASE}/Planets`, auth)
      expect(res.status).to.equal(200)
      expect(res.data.value.length).to.be.greaterThan(0)
    }
  })
})

describe('update authorization boundaries', () => {
  it('rejects a viewer (vera) attempting to PATCH an X row with 403', async () => {
    const list = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'X'&$top=1`, asVera)
    const row = list.data.value[0]
    const res = await PATCH(
      `${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`,
      { spacesuitColor_code: 'GOLD' },
      { ...asVera, validateStatus: () => true },
    )
    expect(res.status).to.equal(403)
  })

  it('lets xavier PATCH the spacesuit color of one of his own (X) rows', async () => {
    const list = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'X'&$top=1`, asXavier)
    const row = list.data.value[0]
    const res = await PATCH(`${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`, { spacesuitColor_code: 'GOLD' }, asXavier)
    expect(res.status).to.equal(200)
    expect(res.data.spacesuitColor_code).to.equal('GOLD')
  })

  it('rejects xavier PATCHing a Y row with 403 or 404', async () => {
    const list = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'Y'&$top=1`, asYvonne)
    const row = list.data.value[0]
    const res = await PATCH(
      `${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`,
      { spacesuitColor_code: 'GOLD' },
      { ...asXavier, validateStatus: () => true },
    )
    expect(res.status).to.be.oneOf([403, 404])
  })
})
