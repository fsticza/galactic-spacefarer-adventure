using SpacefarerService as service from '../../srv/spacefarer-service';

annotate service.Spacefarers with @(
  UI: {
    HeaderInfo: {
      TypeName: 'Spacefarer',
      TypeNamePlural: 'Spacefarers',
      Title: { Value: name },
      Description: { Value: callSign }
    },

    SelectionFields: [
      originPlanet_code,
      spacesuitColor_code,
      department_ID,
      stardustStatus
    ],

    LineItem: [
      { $Type: 'UI.DataField', Value: name },
      { $Type: 'UI.DataField', Value: originPlanet_code },
      { $Type: 'UI.DataField', Value: stardustCollection },
      { $Type: 'UI.DataField', Value: stardustStatus, Criticality: stardustCriticality },
      { $Type: 'UI.DataField', Value: spacesuitColor_code },
      { $Type: 'UI.DataField', Value: wormholeNavigationSkill },
      { $Type: 'UI.DataField', Value: department_ID }
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

    Facets: [
      { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Identity', Label: 'Cosmic Identity' },
      { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Skills', Label: 'Cosmic Skills' },
      { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Assignment', Label: 'Assignment' },
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
        { Value: position_ID },
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
  ID                  @UI.Hidden;
  stardustCriticality @UI.Hidden;
};

annotate service.Departments with @UI.Identification: [{ Value: name }];
annotate service.Departments with {
  ID @Common: { Text: name, TextArrangement: #TextOnly };
};

annotate service.Positions with @UI.Identification: [{ Value: title }];
annotate service.Positions with {
  ID @Common: { Text: title, TextArrangement: #TextOnly };
};
