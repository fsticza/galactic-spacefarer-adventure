import cds from '@sap/cds'
const { GET, PATCH, expect, data } = cds.test(import.meta.dirname + '/..')
beforeEach(data.reset)

import { BASE, asXavier, asYvonne, asVera, asZed, asNobody, throwing } from './helpers.ts'
import type { ODataCollection, SpacefarerRow } from './helpers.ts'

const spacefarers = (res: { data: unknown }) => res.data as ODataCollection<SpacefarerRow>

describe('authentication', () => {
  it('rejects a request without credentials with 401', async () => {
    const res = await GET(`${BASE}/Spacefarers`, throwing)
    expect(res.status).to.equal(401)
  })
})

describe('authorization', () => {
  it('rejects an authenticated user with no galactic role with 403', async () => {
    const res = await GET(`${BASE}/Spacefarers`, { ...asNobody, ...throwing })
    expect(res.status).to.equal(403)
  })

  it('scopes xavier (SpacefarerManager on X) to planet X, count 24', async () => {
    const res = await GET(`${BASE}/Spacefarers?$count=true`, asXavier)
    const body = spacefarers(res)
    expect(body['@odata.count']).to.equal(24)
    expect(body.value.length).to.be.greaterThan(0)
    expect(body.value.every(row => row.originPlanet_code === 'X')).to.equal(true)
  })

  it('scopes yvonne (SpacefarerManager on Y) to planet Y, count 20', async () => {
    const res = await GET(`${BASE}/Spacefarers?$count=true`, asYvonne)
    const body = spacefarers(res)
    expect(body['@odata.count']).to.equal(20)
    expect(body.value.every(row => row.originPlanet_code === 'Y')).to.equal(true)
  })

  it('lets zed (GalacticAdmin) see all 60 rows via $count, paged at 20 with a nextLink', async () => {
    const counted = await GET(`${BASE}/Spacefarers?$count=true`, asZed)
    expect(spacefarers(counted)['@odata.count']).to.equal(60)

    const plain = await GET(`${BASE}/Spacefarers`, asZed)
    expect(spacefarers(plain).value.length).to.equal(20)
    expect(spacefarers(plain)['@odata.nextLink']).to.be.a('string')
  })

  it('returns Planets (global reference data) for every role', async () => {
    for (const auth of [asXavier, asVera, asZed]) {
      const res = await GET(`${BASE}/Planets`, auth)
      expect(res.status).to.equal(200)
      expect(spacefarers(res).value.length).to.be.greaterThan(0)
    }
  })
})

describe('update authorization boundaries', () => {
  const firstOnPlanet = async (planet: string, auth: object): Promise<SpacefarerRow> => {
    const res = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq '${planet}'&$top=1`, auth)
    return spacefarers(res).value[0]
  }

  it('rejects a viewer (vera) attempting to PATCH an X row with 403', async () => {
    const row = await firstOnPlanet('X', asVera)
    const res = await PATCH(
      `${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`,
      { spacesuitColor_code: 'GOLD' },
      { ...asVera, ...throwing },
    )
    expect(res.status).to.equal(403)
  })

  it('lets xavier PATCH the spacesuit color of one of his own (X) rows', async () => {
    const row = await firstOnPlanet('X', asXavier)
    const res = await PATCH(`${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`, { spacesuitColor_code: 'GOLD' }, asXavier)
    expect(res.status).to.equal(200)
    expect((res.data as SpacefarerRow).spacesuitColor_code).to.equal('GOLD')
  })

  it('rejects xavier PATCHing a Y row with 403 or 404', async () => {
    const row = await firstOnPlanet('Y', asYvonne)
    const res = await PATCH(
      `${BASE}/Spacefarers(ID=${row.ID},IsActiveEntity=true)`,
      { spacesuitColor_code: 'GOLD' },
      { ...asXavier, ...throwing },
    )
    expect(res.status).to.be.oneOf([403, 404])
  })
})
