import cds from '@sap/cds'
const { GET, POST, PATCH, expect, data } = cds.test(import.meta.dirname + '/..')
beforeEach(data.reset)

const BASE = '/odata/v4/spacefarers'
const asXavier = { auth: { username: 'xavier', password: 'planetx' } }
const asYvonne = { auth: { username: 'yvonne', password: 'planety' } }
const asZed = { auth: { username: 'zed', password: 'galaxy' } }
const throwing = { validateStatus: () => true }

const draftKey = ID => `${BASE}/Spacefarers(ID=${ID},IsActiveEntity=false)`
const activeKey = ID => `${BASE}/Spacefarers(ID=${ID},IsActiveEntity=true)`

describe('draft: creating a new spacefarer', () => {
  it('POST {} creates a new draft with the planet and default spacesuit color pre-filled', async () => {
    const res = await POST(`${BASE}/Spacefarers`, {}, asYvonne)
    expect(res.status).to.equal(201)
    expect(res.data.IsActiveEntity).to.equal(false)
    expect(res.data.originPlanet_code).to.equal('Y')
    expect(res.data.spacesuitColor_code).to.equal('SILVER')
  })

  it('PATCHing the new draft with name/email/skill succeeds', async () => {
    const draft = await POST(`${BASE}/Spacefarers`, {}, asYvonne)
    const res = await PATCH(draftKey(draft.data.ID), {
      name: 'Draft Yvonne',
      email: 'draft.yvonne@example.com',
      wormholeNavigationSkill: 5,
    }, asYvonne)
    expect(res.status).to.equal(200)
    expect(res.data.name).to.equal('Draft Yvonne')
  })

  it('activating the draft runs the CREATE handlers: planet, bonus, call sign', async () => {
    const draft = await POST(`${BASE}/Spacefarers`, {}, asYvonne)
    await PATCH(draftKey(draft.data.ID), {
      name: 'Draft Yvonne',
      email: 'draft.yvonne2@example.com',
      wormholeNavigationSkill: 5,
    }, asYvonne)

    const activated = await POST(`${draftKey(draft.data.ID)}/SpacefarerService.draftActivate`, {}, asYvonne)
    expect(activated.status).to.equal(201)
    expect(activated.data.IsActiveEntity).to.equal(true)
    expect(activated.data.originPlanet_code).to.equal('Y')
    expect(activated.data.onboardingBonus).to.equal(100)
    expect(activated.data.stardustCollection).to.equal(100)
    expect(activated.data.callSign).to.match(/^Y-/)
  })

  it('rejects xavier setting his own new draft to another planet, targeting originPlanet_code, and leaves it unchanged', async () => {
    const draft = await POST(`${BASE}/Spacefarers`, {}, asXavier)
    expect(draft.data.originPlanet_code).to.equal('X')

    const res = await PATCH(draftKey(draft.data.ID), { originPlanet_code: 'Y' }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(403)
    expect(res.data.error.target).to.equal('originPlanet_code')

    const after = await GET(draftKey(draft.data.ID), asXavier)
    expect(after.data.originPlanet_code).to.equal('X')
  })
})

describe('draft: editing an existing spacefarer', () => {
  it('lets zed draftEdit an existing row, patch it, and activate the changes', async () => {
    const ID = 'c0000000-0000-4000-8000-000000000001' // Aria Voss, X, RED
    const edit = await POST(`${activeKey(ID)}/SpacefarerService.draftEdit`, { PreserveChanges: true }, asZed)
    expect(edit.status).to.equal(201)

    const patched = await PATCH(draftKey(ID), { spacesuitColor_code: 'GOLD', name: 'Aria Voss-Renamed' }, asZed)
    expect(patched.status).to.equal(200)
    expect(patched.data.spacesuitColor_code).to.equal('GOLD')

    // Activating an edit of an already-active row is an UPDATE, not a CREATE, so this returns
    // 200 (unlike activating a brand-new draft, which returns 201 - see the describe block above).
    const activated = await POST(`${draftKey(ID)}/SpacefarerService.draftActivate`, {}, asZed)
    expect(activated.status).to.equal(200)
    expect(activated.data.spacesuitColor_code).to.equal('GOLD')
    expect(activated.data.name).to.equal('Aria Voss-Renamed')
  })

  it('rejects yvonne (Y) starting a draftEdit on an X row', async () => {
    const list = await GET(`${BASE}/Spacefarers?$filter=originPlanet_code eq 'X'&$top=1`, asXavier)
    const ID = list.data.value[0].ID
    const res = await POST(`${activeKey(ID)}/SpacefarerService.draftEdit`, { PreserveChanges: true }, { ...asYvonne, ...throwing })
    expect(res.status).to.be.oneOf([403, 404])
  })

  it('rejects changing the origin planet on an edit draft of an existing spacefarer with 400', async () => {
    const ID = 'c0000000-0000-4000-8000-000000000001' // Aria Voss, X
    await POST(`${activeKey(ID)}/SpacefarerService.draftEdit`, { PreserveChanges: true }, asXavier)

    const res = await PATCH(draftKey(ID), { originPlanet_code: 'Y' }, { ...asXavier, ...throwing })
    expect(res.status).to.equal(400)
    expect(res.data.error.target).to.equal('originPlanet_code')
  })
})
