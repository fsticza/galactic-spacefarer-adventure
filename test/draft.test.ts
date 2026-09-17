import cds from '@sap/cds'
const { GET, POST, PATCH, expect, data } = cds.test(import.meta.dirname + '/..')
beforeEach(data.reset)

import { BASE, asXavier, asYvonne, asZed, throwing, asSpacefarerRow, asSpacefarerCollection, asODataError } from './helpers.ts'

const draftKey = (ID: string) => `${BASE}/Spacefarers(ID=${ID},IsActiveEntity=false)`
const activeKey = (ID: string) => `${BASE}/Spacefarers(ID=${ID},IsActiveEntity=true)`

describe('draft: creating a new spacefarer', () => {
  it('POST {} creates a new draft with the planet and default spacesuit color pre-filled', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {}, asYvonne)
    expect(res.status).to.equal(201)
    const body = asSpacefarerRow(res)
    expect(body.IsActiveEntity).to.equal(false)
    expect(body.originPlanet_code).to.equal('Y')
    expect(body.spacesuitColor_code).to.equal('SILVER')
  })

  it('PATCHing the new draft with name/email/skill succeeds', async () => {
    const draft = await POST(`${BASE}/Spacefarers`, {}, asYvonne)
    const res = await PATCH(draftKey(asSpacefarerRow(draft).ID!), {
      name: 'Draft Yvonne',
      email: 'draft.yvonne@example.com',
      wormholeNavigationSkill: 5,
    }, asYvonne)
    expect(res.status).to.equal(200)
    expect(asSpacefarerRow(res).name).to.equal('Draft Yvonne')
  })

  it('activating the draft runs the CREATE handlers: planet, bonus, call sign', async () => {
    const draft = await POST(`${BASE}/Spacefarers`, {}, asYvonne)
    const ID = asSpacefarerRow(draft).ID!
    await PATCH(draftKey(ID), {
      name: 'Draft Yvonne',
      email: 'draft.yvonne2@example.com',
      wormholeNavigationSkill: 5,
    }, asYvonne)

    const activated = await POST(`${draftKey(ID)}/SpacefarerService.draftActivate`, {}, asYvonne)
    expect(activated.status).to.equal(201)
    const body = asSpacefarerRow(activated)
    expect(body.IsActiveEntity).to.equal(true)
    expect(body.originPlanet_code).to.equal('Y')
    expect(body.onboardingBonus).to.equal(100)
    expect(body.stardustCollection).to.equal(100)
    expect(body.callSign).to.match(/^Y-/)
  })

  it('rejects xavier setting his own new draft to another planet, targeting originPlanet_code, and leaves it unchanged', async () => {
    const draft = await POST(`${BASE}/Spacefarers`, {}, asXavier)
    const ID = asSpacefarerRow(draft).ID!
    expect(asSpacefarerRow(draft).originPlanet_code).to.equal('X')

    const res = await PATCH(draftKey(ID), { originPlanet_code: 'Y' }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(403)
    expect(asODataError(res).error.target).to.equal('originPlanet_code')

    const after = await GET(draftKey(ID), asXavier)
    expect(asSpacefarerRow(after).originPlanet_code).to.equal('X')
  })
})

describe('draft: editing an existing spacefarer', () => {
  it('lets zed draftEdit an existing row, patch it, and activate the changes', async () => {
    const ID = 'c0000000-0000-4000-8000-000000000001' // Aria Voss, X, RED
    const edit = await POST(`${activeKey(ID)}/SpacefarerService.draftEdit`, { PreserveChanges: true }, asZed)
    expect(edit.status).to.equal(201)

    const patched = await PATCH(draftKey(ID), { spacesuitColor_code: 'GOLD', name: 'Aria Voss-Renamed' }, asZed)
    expect(patched.status).to.equal(200)
    expect(asSpacefarerRow(patched).spacesuitColor_code).to.equal('GOLD')

    // Activating an edit of an already-active row is an UPDATE, not a CREATE, so this returns
    // 200 (unlike activating a brand-new draft, which returns 201 - see the describe block above).
    const activated = await POST(`${draftKey(ID)}/SpacefarerService.draftActivate`, {}, asZed)
    expect(activated.status).to.equal(200)
    const body = asSpacefarerRow(activated)
    expect(body.spacesuitColor_code).to.equal('GOLD')
    expect(body.name).to.equal('Aria Voss-Renamed')
  })

  it('rejects yvonne (Y) starting a draftEdit on an X row', async () => {
    const list = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'X'&$top=1`, asXavier)
    const ID = asSpacefarerCollection(list).value[0].ID!
    const res = await POST(`${activeKey(ID)}/SpacefarerService.draftEdit`, { PreserveChanges: true }, { ...asYvonne, ...throwing })
    expect(res.status).to.be.oneOf([403, 404])
  })

  it('rejects changing the origin planet on an edit draft of an existing spacefarer with 400', async () => {
    const ID = 'c0000000-0000-4000-8000-000000000001' // Aria Voss, X
    await POST(`${activeKey(ID)}/SpacefarerService.draftEdit`, { PreserveChanges: true }, asXavier)

    const res = await PATCH(draftKey(ID), { originPlanet_code: 'Y' }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)
    expect(asODataError(res).error.target).to.equal('originPlanet_code')
  })
})
