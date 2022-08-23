# FrancescaD - IFC viewer

Sample app to develop a custom BIM library and load new IFC models.

## Description

This app offers a nice gallery to keep all your BIM models and gets you the possibility to load more models, beside the gallery contents. It is built on top of IFC.js and it is optimized to view IFC models.
Custom buttons and custom UI with a focus on data B(I)M.

## Status

POC - First play with IFC.js

## Getting Started

### Dependencies

This app is built on top of IFC.js and uses web-ifc and web-ifc-viewer.

- IFC.js: `web-ifc` and `web-ifc-viewer`
- ThreeJS: `three` is a dependency to install

### Contents

- `static/IFC`: BIM models folder
- `projects.js`: detailed list of projects - name, id, path, (-> image)
- `projects-list.js`: gallery logic
- `viewer.js`: IFC viewer and custom implementations

### Functionalities and future implementations

- [x] BIM gallery
- [x] IFC viewer: geometry and data
- [x] IFC load new models (single and multiple models)
- [x] Hide/Isolate object
- [x] 3D clipping planes
- [x] Custom Tree view: name-ID (Project,Site,Building,BuildingStoreys), type-ID (instances)
- [x] Custom Property menu: base on single selection shows IFC properties - native, type, materials, QuantitySets, Psets
- [x] Custom IfcClasses Project Browser: lists the IFC classes included in the model and highlights the corrisponding elements

- [ ] Considering model coordinates (to have a federation environments)
- [ ] Grouping the instances by Class in the Tree view
- [ ] Investigate tab interface for the Property menu

## Authors

Francesca D'Uffizi
[@duffra](https://www.linkedin.com/in/francesca-d-uffizi-52248a7a/)

## Version History

- 0.1
  - Initial Release

## Acknowledgments

Inspiration, code snippets, etc.

- [IFC.js](https://ifcjs.github.io/info/)
