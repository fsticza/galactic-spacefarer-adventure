import {
  ONBOARDING_BONUS,
  HAZARD_BONUS,
  HAZARD_THRESHOLD,
  MIN_SKILL,
  MAX_SKILL,
  MAX_STARDUST,
  certify,
  callSignFor,
  completeAssignment,
  validateCandidate,
  enhanceCandidate,
} from '../srv/lib/spacefarer-rules.ts'

// Pure unit tests: no cds.test() here, these functions have no CAP dependency.

describe('certify', () => {
  it('returns Cadet below 4', () => {
    expect(certify(1)).to.equal('Cadet')
    expect(certify(3)).to.equal('Cadet')
  })

  it('returns Navigator from 4 to 7', () => {
    expect(certify(4)).to.equal('Navigator')
    expect(certify(7)).to.equal('Navigator')
  })

  it('returns Master from 8 upwards', () => {
    expect(certify(8)).to.equal('Master')
    expect(certify(10)).to.equal('Master')
  })
})

describe('callSignFor', () => {
  it('formats PLANET-INITIALS-HEX using the injected random source', () => {
    // Math.floor(0.5 * 0x10000) = 32768 = 0x8000
    expect(callSignFor('Aria Voss', 'X', () => 0.5)).to.equal('X-AV-8000')
  })

  it('pads the hex suffix to 4 digits and upper-cases it', () => {
    // Math.floor(0 * 0x10000) = 0 -> '0000'
    expect(callSignFor('Cleo Marchetti', 'x', () => 0)).to.equal('X-CM-0000')
    // just under 1 -> 0xffff
    expect(callSignFor('Cleo Marchetti', 'x', () => 0.999999999)).to.equal('X-CM-FFFF')
  })

  it('derives initials from up to 3 words of the name', () => {
    expect(callSignFor('Anouk de Vries', 'Y', () => 0.5)).to.equal('Y-ADV-8000')
  })

  it('falls back to SF when the name has no usable initials', () => {
    expect(callSignFor('', 'ZOG', () => 0.5)).to.equal('ZOG-SF-8000')
    expect(callSignFor('   ', 'ZOG', () => 0.5)).to.equal('ZOG-SF-8000')
  })

  it('upper-cases the planet code and defaults it when missing', () => {
    expect(callSignFor('Aria Voss', undefined, () => 0.5)).to.equal('UNK-AV-8000')
  })
})

describe('completeAssignment', () => {
  it('derives the department from the position when the candidate has none', () => {
    const position = { department_ID: 'd-1' }
    expect(completeAssignment({}, position)).to.deep.equal({ department_ID: 'd-1' })
  })

  it('leaves an explicit candidate department untouched, even if it differs from the position', () => {
    const position = { department_ID: 'd-1' }
    const candidate = { department_ID: 'd-2' }
    expect(completeAssignment(candidate, position)).to.deep.equal({})
  })

  it('returns nothing when there is no position', () => {
    expect(completeAssignment({}, null)).to.deep.equal({})
    expect(completeAssignment({}, undefined)).to.deep.equal({})
  })

  it('returns nothing when the position has no department either', () => {
    expect(completeAssignment({}, {})).to.deep.equal({})
  })
})

describe('validateCandidate', () => {
  it('has no problems when there is no position', () => {
    expect(validateCandidate({ wormholeNavigationSkill: 1 }, null)).to.deep.equal([])
  })

  it('accepts a candidate whose skill meets the minimum and whose department matches', () => {
    const position = { title: 'Wormhole Pilot', minWormholeSkill: 6, department_ID: 'd-1' }
    const candidate = { wormholeNavigationSkill: 6, department_ID: 'd-1' }
    expect(validateCandidate(candidate, position)).to.deep.equal([])
  })

  it('flags a position/department mismatch, targeting position_ID', () => {
    const position = { title: 'Wormhole Pilot', minWormholeSkill: 1, department_ID: 'd-1' }
    const candidate = { wormholeNavigationSkill: 10, department_ID: 'd-2' }
    const problems = validateCandidate(candidate, position)
    expect(problems).to.have.lengthOf(1)
    expect(problems[0].field).to.equal('position_ID')
    expect(problems[0].key).to.equal('POSITION_DEPARTMENT_MISMATCH')
    expect(problems[0].args).to.deep.equal(['Wormhole Pilot'])
  })

  it('flags a skill below the position minimum, targeting wormholeNavigationSkill', () => {
    const position = { title: 'Chief Navigator', minWormholeSkill: 9, department_ID: 'd-1' }
    const candidate = { wormholeNavigationSkill: 2, department_ID: 'd-1' }
    const problems = validateCandidate(candidate, position)
    expect(problems).to.have.lengthOf(1)
    expect(problems[0].field).to.equal('wormholeNavigationSkill')
    expect(problems[0].key).to.equal('POSITION_SKILL_TOO_LOW')
    expect(problems[0].args).to.deep.equal(['Chief Navigator', 9])
  })

  it('can report both problems at once', () => {
    const position = { title: 'Chief Navigator', minWormholeSkill: 9, department_ID: 'd-1' }
    const candidate = { wormholeNavigationSkill: 2, department_ID: 'd-2' }
    const problems = validateCandidate(candidate, position)
    expect(problems.map(p => p.field).sort()).to.deep.equal(['position_ID', 'wormholeNavigationSkill'])
  })

  it('defaults a missing skill to MIN_SKILL for the comparison', () => {
    const position = { title: 'Navigator Cadet', minWormholeSkill: MIN_SKILL, department_ID: 'd-1' }
    const candidate = { department_ID: 'd-1' }
    expect(validateCandidate(candidate, position)).to.deep.equal([])
  })
})

describe('enhanceCandidate', () => {
  const now = () => new Date('2026-09-16T00:00:00.000Z')

  it('applies the standard bonus and no skill bump for a non-hazardous planet', () => {
    const candidate = { name: 'Aria Voss', wormholeNavigationSkill: 3, stardustCollection: 50, originPlanet_code: 'X' }
    const planet = { code: 'X', hazardLevel: 2 }
    const result = enhanceCandidate(candidate, planet, now)
    expect(result.onboardingBonus).to.equal(ONBOARDING_BONUS)
    expect(result.stardustCollection).to.equal(150)
    expect(result.wormholeNavigationSkill).to.equal(3)
    expect(result.wormholeCertification).to.equal('Cadet')
    expect(result.launchedAt).to.equal('2026-09-16T00:00:00.000Z')
  })

  it('applies the hazard bonus and a skill bump for a hazardous planet (hazardLevel >= threshold)', () => {
    const candidate = { name: 'Tarek Mansour', wormholeNavigationSkill: 7, stardustCollection: 0, originPlanet_code: 'ZOG' }
    const planet = { code: 'ZOG', hazardLevel: 5 }
    const result = enhanceCandidate(candidate, planet, now)
    expect(HAZARD_THRESHOLD).to.be.at.most(5)
    expect(result.onboardingBonus).to.equal(ONBOARDING_BONUS + HAZARD_BONUS)
    expect(result.onboardingBonus).to.equal(150)
    expect(result.stardustCollection).to.equal(150)
    expect(result.wormholeNavigationSkill).to.equal(8)
    expect(result.wormholeCertification).to.equal('Master')
  })

  it('caps stardustCollection at MAX_STARDUST', () => {
    const candidate = { name: 'Kaia Nakamura', wormholeNavigationSkill: 5, stardustCollection: MAX_STARDUST - 40 }
    const result = enhanceCandidate(candidate, { hazardLevel: 2 }, now)
    expect(result.stardustCollection).to.equal(MAX_STARDUST)
  })

  it('caps wormholeNavigationSkill at MAX_SKILL even with the hazard bump', () => {
    const candidate = { name: 'Hiro Tanaka', wormholeNavigationSkill: MAX_SKILL }
    const result = enhanceCandidate(candidate, { hazardLevel: 5 }, now)
    expect(result.wormholeNavigationSkill).to.equal(MAX_SKILL)
  })

  it('defaults candidate skill and stardust when missing', () => {
    const result = enhanceCandidate({ name: 'New Candidate' }, { hazardLevel: 1 }, now)
    expect(result.wormholeNavigationSkill).to.equal(MIN_SKILL)
    expect(result.stardustCollection).to.equal(ONBOARDING_BONUS)
  })

  it('prefers the planet code over the candidate-supplied origin for the call sign', () => {
    const result = enhanceCandidate({ name: 'Aria Voss', originPlanet_code: 'Y' }, { code: 'X', hazardLevel: 2 }, now)
    expect(result.callSign.startsWith('X-')).to.equal(true)
  })

  it('does not mutate its inputs', () => {
    const candidate = Object.freeze({ name: 'Aria Voss', wormholeNavigationSkill: 3, stardustCollection: 50 })
    const planet = Object.freeze({ code: 'X', hazardLevel: 2 })
    expect(() => enhanceCandidate(candidate, planet, now)).to.not.throw()
  })
})
