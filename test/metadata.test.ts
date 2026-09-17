import cds from '@sap/cds'
const { GET, expect } = cds.test(import.meta.dirname + '/..')

import { BASE, asXavier } from './helpers.ts'

describe('SpacefarerService $metadata', () => {
  let xml: string

  beforeAll(async () => {
    const res = await GET(`${BASE}/$metadata`, asXavier)
    xml = res.data as string
  })

  it('is served as XML text', () => {
    expect(xml).to.be.a('string')
    expect(xml).to.contain('<?xml')
    expect(xml).to.contain('<edmx:Edmx')
  })

  it('declares the draft-enabled Spacefarers entity type with an IsActiveEntity key part', () => {
    const entityType = extractBlock(xml, '<EntityType Name="Spacefarers">', '</EntityType>')
    expect(entityType).to.be.a('string')
    expect(entityType).to.contain('<PropertyRef Name="IsActiveEntity"/>')
    expect(entityType).to.contain('<Property Name="IsActiveEntity" Type="Edm.Boolean"')
  })

  it('has a Common.ValueList on spacesuitColor_code pointing at SpacesuitColors', () => {
    const block = extractAnnotationsBlock(xml, 'SpacefarerService.Spacefarers/spacesuitColor_code')
    expect(block).to.contain('Common.ValueList')
    expect(block).to.contain('CollectionPath" String="SpacesuitColors"')
  })

  it('has a Common.ValueList on originPlanet_code pointing at Planets', () => {
    const block = extractAnnotationsBlock(xml, 'SpacefarerService.Spacefarers/originPlanet_code')
    expect(block).to.contain('Common.ValueList')
    expect(block).to.contain('CollectionPath" String="Planets"')
  })

  it('has a Common.ValueList on department_ID pointing at Departments', () => {
    const block = extractAnnotationsBlock(xml, 'SpacefarerService.Spacefarers/department_ID')
    expect(block).to.contain('Common.ValueList')
    expect(block).to.contain('CollectionPath" String="Departments"')
  })

  // @Core.Immutable on originPlanet_code (and name/email) was deliberately removed from the
  // model: the cds 10 runtime strips immutable fields from every draft PATCH, including the
  // create dialog's own draft, which broke onboarding a new candidate. Immutability of the
  // origin planet on an *existing* spacefarer is now enforced in srv/spacefarer-service.js
  // (see create.test.js / draft.test.js for the corresponding 400 behaviour), not declaratively.

  it('marks callSign as Core.Computed', () => {
    const block = extractAnnotationsBlock(xml, 'SpacefarerService.Spacefarers/callSign')
    expect(block).to.contain('Core.Computed" Bool="true"')
  })

  it('marks Planets as not insertable via Capabilities.InsertRestrictions', () => {
    const block = extractAnnotationsBlock(xml, 'SpacefarerService.EntityContainer/Planets')
    expect(block).to.contain('Capabilities.InsertRestrictions')
    expect(block).to.contain('Insertable" Bool="false"')
  })
})

/** Extracts the first `${open}...${close}` slice from an XML string, or undefined if not found. */
function extractBlock(xml: string, open: string, close: string): string | undefined {
  const start = xml.indexOf(open)
  if (start === -1) return undefined
  const end = xml.indexOf(close, start)
  if (end === -1) return undefined
  return xml.slice(start, end + close.length)
}

/** Extracts the `<Annotations Target="...">...</Annotations>` block for a given target. */
function extractAnnotationsBlock(xml: string, target: string): string | undefined {
  return extractBlock(xml, `<Annotations Target="${target}">`, '</Annotations>')
}
