import cds from '@sap/cds/eslint.config.mjs'

export default [
  // Generated Fiori tools OPA journeys run in the browser (QUnit globals) and are excluded from linting.
  { ignores: ['app/**/webapp/test/**', 'gen/**', 'mta_archives/**'] },
  ...cds.recommended,
]
