using SpacefarerService as service from '../../srv/spacefarer-service';

annotate service.Spacefarers with @(
  UI: {
    HeaderInfo: {
      TypeName: 'Spacefarer',
      TypeNamePlural: 'Spacefarers',
      Title: { Value: name },
      Description: { Value: callSign },
      // Fills the empty avatar slot in the object page header with an icon, since spacefarers
      // carry no photo.
      TypeImageUrl: 'sap-icon://person-placeholder'
    },

    SelectionFields: [
      originPlanet_code,
      spacesuitColor_code,
      department_ID,
      stardustStatus,
      wormholeCertification
    ],

    // Importance drives what a ResponsiveTable keeps when it runs out of width: without it
    // every column is equal and the last ones defined (skill, department) were simply dropped
    // at 1600px, which hid the one number the whole app is about. High = never dropped.
    LineItem: [
      { $Type: 'UI.DataField', Value: name, @UI.Importance: #High },
      { $Type: 'UI.DataField', Value: originPlanet_code, @UI.Importance: #High },
      { $Type: 'UI.DataField', Value: stardustCollection, @UI.Importance: #High },
      { $Type: 'UI.DataField', Value: stardustStatus, Criticality: stardustCriticality, @UI.Importance: #High },
      // A 1..10 number says little at a glance; a progress bar against the maximum reads
      // instantly and still sorts and filters as the underlying integer.
      { $Type: 'UI.DataFieldForAnnotation', Target: '@UI.DataPoint#SkillProgress', Label: '{i18n>WormholeNavigationSkill}', @UI.Importance: #High },
      { $Type: 'UI.DataField', Value: wormholeCertification, Criticality: certificationCriticality, @UI.Importance: #Medium },
      { $Type: 'UI.DataField', Value: spacesuitColor_code, @UI.Importance: #Low },
      { $Type: 'UI.DataField', Value: department_ID, @UI.Importance: #Low }
    ],

    PresentationVariant: {
      SortOrder: [
        { Property: stardustCollection, Descending: true }
      ],
      Visualizations: ['@UI.LineItem']
    },

    HeaderFacets: [
      { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Stardust' },
      { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Skill' }
    ],

    DataPoint #Stardust: {
      Value: stardustCollection,
      Title: 'Stardust Collection',
      Criticality: stardustCriticality
    },

    DataPoint #Skill: {
      Value: wormholeNavigationSkill,
      Title: 'Wormhole Navigation Skill',
      Visualization: #Rating,
      TargetValue: 10
    },

    // Same element as #Skill, shown as a bar rather than ten stars: stars are fine in the roomy
    // object page header, but would dominate a table row.
    DataPoint #SkillProgress: {
      Value: wormholeNavigationSkill,
      Title: '{i18n>WormholeNavigationSkill}',
      Visualization: #Progress,
      TargetValue: 10,
      Criticality: certificationCriticality
    },

    Facets: [
      { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Identity', Label: 'Cosmic Identity' },
      { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Skills', Label: 'Cosmic Skills' },
      { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Assignment', Label: 'Assignment' },
      { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Biography', Label: 'Biography' },
      { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Log', Label: 'Launch Log' }
    ],

    FieldGroup #Identity: {
      Data: [
        { Value: name },
        { Value: email },
        { Value: originPlanet_code },
        { Value: callSign },
        { Value: wormholeCertification }
      ]
    },

    FieldGroup #Skills: {
      Data: [
        { Value: stardustCollection },
        { Value: stardustStatus },
        { Value: wormholeNavigationSkill },
        { Value: spacesuitColor_code },
        { Value: onboardingBonus }
      ]
    },

    FieldGroup #Assignment: {
      Data: [
        { Value: department_ID },
        { Value: position_ID }
      ]
    },

    // `bio` is a LargeString rendered as a multi-line text. In the four-column Assignment grid
    // it was squeezed into one narrow cell; its own facet gives it the full width.
    FieldGroup #Biography: {
      Data: [
        { Value: bio }
      ]
    },

    FieldGroup #Log: {
      Data: [
        { Value: launchedAt },
        { Value: createdAt },
        { Value: createdBy },
        { Value: modifiedAt },
        { Value: modifiedBy }
      ]
    }
  }
);

annotate service.Spacefarers with {
  // Origin planet is fixed once a candidate has launched. @Core.Immutable was dropped from the
  // service (cds 10 cleanses immutable fields from every draft PATCH, including the create
  // dialog's own draft), so the boundary is expressed here as a dynamic field control instead:
  // read-only when editing an existing (already-active) row, mandatory in the create dialog.
  //
  // Annotated via the association (originPlanet), not the flat originPlanet_code path: at the
  // point annotate statements are resolved, the foreign-key property does not exist yet as an
  // element (it is generated later, during odata processing) so `originPlanet_code @Common: {...}`
  // silently fails to resolve ("Element ... has not been found") and the annotation is dropped.
  // Annotating the association still lands the annotations on the generated originPlanet_code
  // property in $metadata, which is what Fiori elements needs.
  originPlanet   @Common: {
    Text: originPlanet.name,
    TextArrangement: #TextOnly,
    ValueListWithFixedValues,
    FieldControl: { $edmJson: { $If: [ { $Eq: [ { $Path: 'HasActiveEntity' }, true ] }, 1, 7 ] } }
  };
  spacesuitColor @Common: { Text: spacesuitColor.name, TextArrangement: #TextOnly, ValueListWithFixedValues };
  department     @Common: { Text: department.name, TextArrangement: #TextOnly };
  position       @Common: { Text: position.title, TextArrangement: #TextOnly };
  // Renders the address as a mailto link instead of plain text, in both the list and the
  // object page.
  email @Communication.IsEmailAddress;
  ID                       @UI.Hidden;
  stardustCriticality      @UI.Hidden;
  certificationCriticality @UI.Hidden;
};

annotate service.Departments with @UI.Identification: [{ Value: name }];
annotate service.Departments with {
  ID @Common: { Text: name, TextArrangement: #TextOnly };
};

annotate service.Positions with @UI.Identification: [{ Value: title }];
annotate service.Positions with {
  ID @Common: { Text: title, TextArrangement: #TextOnly };
};
