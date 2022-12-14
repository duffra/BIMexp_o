import { projects } from "./projects.js";
import { Color } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";

let original_pickableIfcModels;
let selectedSubset;

let isolateBtnActive = false;
let hideBtnActive = false;

let nativePropertiesBtnActive = true; 
let typePropertiesBtnActive = false;
let materialPropertiesBtnActive = false;
let psetsPropertiesBtnActive = false;

let viewer;


window.document.body.style.overflow = "hidden";
const currentURL = window.location.href;
url = new URL(currentURL);
const currentProjectID = url.searchParams.get("id");
let currentProject;
main();

//Make the DIV element draggagle:
dragElement(document.getElementById("mydiv"));


async function main(){
  viewer = await setupScene();
  setupProgressNotification(viewer);
  const model=await setupPage(viewer);
  getBack(viewer);
  setupToolbarCmd(viewer, model);
  setupEvents(viewer, model);

  return viewer;
}

async function setupScene(){
  const container = document.getElementById("viewer-container");
  const viewer = new IfcViewerAPI({
    container,
    backgroundColor: new Color(0xffffff),
  });
  viewer.grid.setGrid();
  viewer.axes.setAxes();
  setUpMultiThreading(viewer);
  return viewer;
}

async function setupPage(viewer){
  let model;
  if (currentProjectID === "0") {
    const input = document.getElementById("custom-file-upload");
    input.style.visibility = "visible";
    const title = document.getElementById("project-title");
    title.innerHTML = "Your project";
    input.addEventListener(
      "change",
      async (changed) => {
        const ifcURL = URL.createObjectURL(changed.target.files[0]);
        model=loadIfc(viewer, ifcURL);
      },
    );
  } else {
    for (p of projects) {
      if (p.id === currentProjectID) {
        currentProject = p;
      }
    }
  
    const title = document.getElementById("project-title");
    title.innerHTML = currentProject.name;
    const currentPath = currentProject.path;
    model=loadIfc(viewer, currentPath);
  }
  return model;
}

async function loadIfc(viewer, url) {
  await viewer.IFC.setWasmPath("./");
  const model = await viewer.IFC.loadIfcUrl(url);
  await viewer.shadowDropper.renderShadow(model.modelID);
  viewer.context.renderer.postProduction.active = true;
  const ifcProject = await viewer.IFC.getSpatialStructure(model.modelID);
  //console.log("Treeview= " + JSON.stringify(ifcProject));
  await createTreeMenu(viewer, ifcProject, model.modelID);
  setIfcPropertiesContent(ifcProject, viewer, model);
  const items = viewer.context.items;
  original_pickableIfcModels = items.pickableIfcModels; 

  return model;
}

function setupEvents(viewer, model){
  const propsGUI = document.getElementById("ifc-property-menu-root");
  const native_HTML = document.getElementById("native-prop");
  const nativePropertiesButton = document.getElementById("btn-properties-native");

  window.onmousemove = async () => await viewer.IFC.selector.prePickIfcItem();
  window.onclick = async () => {
    viewer.IFC.selector.unpickIfcItems();
    removeAllChildren(propsGUI);
    const selected = await viewer.IFC.selector.pickIfcItem();
    if (!selected) return;
  
    if (isolateBtnActive) {
      let selectedIDs=[];
      selectedIDs.push(selected.id);
      isolate(selectedIDs, viewer, model);
    }
  
    if (hideBtnActive) {
      let selectedIDs=[];
      selectedIDs.push(selected.id);
      hide(selectedIDs, viewer, model);
    }
    
    if(nativePropertiesBtnActive){
      nativePropertiesButton.classList.add("active-btn");
      native_HTML.classList.add("selected");
      removeAllChildren(propsGUI);
      if (!selected) return;
      const { modelID, id } = selected;
      const props = await viewer.IFC.getProperties(modelID, id); 
      try {
        createPropertiesMenu_native(props);
      } catch {
        removeAllChildren(propsGUI);
      }
    }
    else {
      nativePropertiesButton.classList.remove("active-btn");
      native_HTML.classList.remove("selected");
      removeAllChildren(propsGUI);
    };  
    
    if (typePropertiesBtnActive){
      removeAllChildren(propsGUI);
      if (!selected) return;
      const { modelID, id } = selected;
      const props_type = await viewer.IFC.loader.ifcManager.getTypeProperties(
        modelID,
        id,
        true
      );
      try {
        createPropertiesMenu_type(props_type);
      } catch {
        removeAllChildren(propsGUI);
      }
    }
    if(materialPropertiesBtnActive){
      removeAllChildren(propsGUI);
      if (!selected) return;
      const { modelID, id } = selected;
      const props_material =
        await viewer.IFC.loader.ifcManager.getMaterialsProperties(
          modelID,
          id,
          true
        );
      try {
        createPropertiesMenu_material(props_material);
      } catch {
        removeAllChildren(propsGUI);
      }
    }
    if(psetsPropertiesBtnActive){
      removeAllChildren(propsGUI);
      if (!selected) return;
      const { modelID, id } = selected;
      const props_psets = await viewer.IFC.loader.ifcManager.getPropertySets(
        modelID,
        id,
        true
      );
      try {
        createPropertiesMenu_pset(props_psets);
      } catch {
        removeAllChildren(propsGUI);
      }
    }
  };
  window.ondblclick = async () => {
    if (viewer.clipper.active) {
      viewer.clipper.createPlane();
    }
  };
  window.onkeydown = (event) => {
    if (viewer.clipper.active && event.key == "Escape") {
      viewer.clipper.deleteAllPlanes();
      viewer.context.renderer.postProduction.update();
    }
  };
}

function isolate(ids,viewer, mymodel){
  const scene = viewer.context.getScene();
  mymodel.removeFromParent();
  selectedSubset = viewer.IFC.loader.ifcManager.createSubset({
    modelID: 0,
    scene,
    ids: ids,
    removePrevious: true,
    customID: "isolated-selection",
  });
  togglePickable(viewer, mymodel,selectedSubset,true);
  viewer.context.renderer.postProduction.update();
}

function hide(ids,viewer, mymodel){
  const allIds=getAllIds(mymodel);
  let all=[...allIds];

  const wholeModel=getWholeSubset(viewer,mymodel,all);
  //mymodel.removeFromParent();
  replaceOriginalModelBySubset(viewer, mymodel, wholeModel);
  viewer.IFC.loader.ifcManager.removeFromSubset(mymodel.modelID,ids,"full-model-subset")
  viewer.context.renderer.postProduction.update();
  viewer.IFC.selector.unpickIfcItems();
}

function getAllIds(ifcModel) {
	return Array.from(
		new Set(ifcModel.geometry.attributes.expressID.array),
	);
}

function getWholeSubset(viewer, ifcModel, allIDs) {
	return viewer.IFC.loader.ifcManager.createSubset({
		modelID: ifcModel.modelID,
		ids: allIDs,
		applyBVH: true,
		scene: ifcModel.parent,
		removePrevious: true,
		customID: 'full-model-subset',
	});
}

function replaceOriginalModelBySubset(viewer, ifcModel, subset) {
	const items = viewer.context.items;

	items.pickableIfcModels = items.pickableIfcModels.filter(model => model !== ifcModel);
	items.ifcModels = items.ifcModels.filter(model => model !== ifcModel);
	ifcModel.removeFromParent();

	items.ifcModels.push(subset);
	items.pickableIfcModels.push(subset);
}

function showOriginal(viewer, myModel){
  viewer.IFC.loader.ifcManager.clearSubset(myModel.modelID,"full-model-subset");
  viewer.context.scene.add(myModel);
  viewer.context.renderer.postProduction.update();
  viewer.context.items.pickableIfcModels = original_pickableIfcModels;
}

function togglePickable(viewer, mymodel, mysubset, isPickable){
  if (isPickable){
    viewer.context.items.pickableIfcModels = viewer.context.items.pickableIfcModels.filter((m) => m !== mymodel);
    viewer.context.items.pickableIfcModels.push(mysubset);
  }
  else
  {
    viewer.context.items.pickableIfcModels = original_pickableIfcModels;
  }
}

function dragElement(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  if (document.getElementById(elmnt.id + "header")) {
    /* if present, the header is where you move the DIV from:*/
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  } else {
    /* otherwise, move the DIV from anywhere inside the DIV:*/
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function getBack(viewer){
  //BACK BUTTON ----------------------------------------------------------------------------------------
  const backBtn = document.getElementById("btn-back");
  backBtn.onclick = () => {
    viewer.dispose();
    window.open("./index.html", "_self");
  };
}

function setupHideButton(viewer, model){
  //HIDE BUTTON ----------------------------------------------------------------------------------------
  const hideButton = document.getElementById("btn-hide");
  hideButton.onclick = () => {
    hideBtnActive = !hideBtnActive;
    if (hideBtnActive) {
      hideButton.classList.add("active-btn");
    } else {
      hideButton.classList.remove("active-btn");
      showOriginal(viewer, model);
    }
  };
}

function setupIsolateButton(viewer,model){
  //ISOLATE BUTTON ----------------------------------------------------------------------------------------
  const isolateButton = document.getElementById("btn-isolate");
  isolateButton.onclick = () => {
    isolateBtnActive = !isolateBtnActive;
    if (isolateBtnActive) {
      isolateButton.classList.add("active-btn");
    } else {
      isolateButton.classList.remove("active-btn");
      //viewer.IFC.selector.unHighlightIfcItems();
      if (selectedSubset) {
        viewer.IFC.loader.ifcManager.clearSubset(
          model.modelID, 
          "isolated-selection"
        );
        viewer.context.scene.add(model);
        togglePickable(viewer, model,selectedSubset,false);
        viewer.context.renderer.postProduction.update();
        viewer.IFC.selector.unpickIfcItems();
      }
    }
  };
}

function setupClipperButton(viewer){
  //CLIP BUTTON ----------------------------------------------------------------------------------------
  const sectionButton = document.getElementById("btn-section");
  let sectionBtnActive = false;
  sectionButton.onclick = () => {
    sectionBtnActive = !sectionBtnActive;
    if (sectionBtnActive) {
      sectionButton.classList.add("active-btn");
    } else {
      sectionButton.classList.remove("active-btn");
    }
    viewer.clipper.active = sectionBtnActive;
  };
}

function setupToolbarCmd(viewer, model){
  setupClipperButton(viewer);
  setupIsolateButton(viewer, model);
  setupHideButton(viewer, model);
  setupNativeProps();
  setupTypeProps();
  setupMaterialProps();
  setupPsetsProps();
}

function getIfcClass(ifcProject) {
  let typeArray = [];
  return getIfcClass_base(ifcProject, typeArray);
}
function getIfcClass_base(ifcProject, typeArray) {
  const children = ifcProject.children;
  if (children.length === 0) {
    typeArray.push(ifcProject.type);
  } else {
    for (const obj of children) {
      getIfcClass_base(obj, typeArray);
    }
  }
  return typeArray;
}

function setIfcPropertiesContent(ifcProject, viewer, model) {
  const ifcClass = getIfcClass(ifcProject);
  let uniqueClasses = [...new Set(ifcClass)];

  //console.log(JSON.stringify(uniqueClasses));
  const classessGUI = document.getElementById("ifc-class-menu-root");
  for (const ifcClass of uniqueClasses) {
    createClassEntry(ifcClass, classessGUI, viewer, model);
  }
}

async function getObjects(viewer, modelID, text) {
  const webifcTypes = viewer.IFC.loader.ifcManager.typesMap;
  const key = Object.keys(webifcTypes).find((key) => webifcTypes[key] === text);
  const keyNumber = parseInt(key);
  console.log(key + "KeyNumber:" + keyNumber);
  const filteredElements = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
    modelID,
    keyNumber,
    true
  );
  let filteredIDs = [];
  for (const element of filteredElements) {
    filteredIDs.push(element.expressID);
  }
  //console.log(JSON.stringify(filteredElements));
  return filteredIDs;
}

function createClassEntry(key, classessGUI, viewer, model) {
  const propContainer = document.createElement("div");
  propContainer.classList.add("ifc-classes-item");

  const keyElement = document.createElement("div");
  keyElement.textContent = key;
  propContainer.appendChild(keyElement);

  const divSvg = document.createElement("button");
  divSvg.classList.add("btn-ifcClasses","middle");
  const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  iconSvg.classList.add("class-icon","isolate");
  iconSvg.setAttribute("clip-rule", "evenodd");
  iconSvg.setAttribute("fill-rule", "evenodd");
  iconSvg.setAttribute("stroke-linejoin", "round");
  iconSvg.setAttribute("stroke-miterlimit", "2");
  iconSvg.setAttribute("viewBox", "0 0 24 24");
  iconSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const pathSvg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  pathSvg.setAttribute(
    "d",
    "m17.5 11c2.484 0 4.5 2.016 4.5 4.5s-2.016 4.5-4.5 4.5-4.5-2.016-4.5-4.5 2.016-4.5 4.5-4.5zm-5.346 6.999c-.052.001-.104.001-.156.001-4.078 0-7.742-3.093-9.854-6.483-.096-.159-.144-.338-.144-.517s.049-.358.145-.517c2.111-3.39 5.775-6.483 9.853-6.483 4.143 0 7.796 3.09 9.864 6.493.092.156.138.332.138.507s-.046.351-.138.507l-.008.013c-1.079-1.18-2.631-1.92-4.354-1.92-.58 0-1.141.084-1.671.24-.498-1.643-2.025-2.84-3.829-2.84-2.208 0-4 1.792-4 4 0 2.08 1.591 3.792 3.622 3.982-.014.171-.022.343-.022.518 0 .893.199 1.74.554 2.499zm3.071-2.023 1.442 1.285c.095.085.215.127.333.127.136 0 .271-.055.37-.162l2.441-2.669c.088-.096.131-.217.131-.336 0-.274-.221-.499-.5-.499-.136 0-.271.055-.37.162l-2.108 2.304-1.073-.956c-.096-.085-.214-.127-.333-.127-.277 0-.5.224-.5.499 0 .137.056.273.167.372zm-3.277-2.477c-1.356-.027-2.448-1.136-2.448-2.499 0-1.38 1.12-2.5 2.5-2.5 1.193 0 2.192.837 2.44 1.955-1.143.696-2.031 1.768-2.492 3.044z"
  );
  pathSvg.setAttribute("fill-rule", "nonzero");
  iconSvg.appendChild(pathSvg);
  divSvg.appendChild(iconSvg);
  propContainer.appendChild(divSvg);

  const divSvg2 = document.createElement("button");
  divSvg2.classList.add("btn-ifcClasses");
  const iconSvg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  iconSvg2.classList.add("class-icon","hide");
  iconSvg2.setAttribute("clip-rule", "evenodd");
  iconSvg2.setAttribute("fill-rule", "evenodd");
  iconSvg2.setAttribute("stroke-linejoin", "round");
  iconSvg2.setAttribute("stroke-miterlimit", "2");
  iconSvg2.setAttribute("viewBox", "0 0 24 24");
  iconSvg2.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const pathSvg2 = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  pathSvg2.setAttribute(
    "d",
    "m17.069 6.546 2.684-2.359c.143-.125.32-.187.497-.187.418 0 .75.34.75.75 0 .207-.086.414-.254.562l-16.5 14.501c-.142.126-.319.187-.496.187-.415 0-.75-.334-.75-.75 0-.207.086-.414.253-.562l2.438-2.143c-1.414-1.132-2.627-2.552-3.547-4.028-.096-.159-.144-.338-.144-.517s.049-.358.145-.517c2.111-3.39 5.775-6.483 9.853-6.483 1.815 0 3.536.593 5.071 1.546zm2.318 1.83c.967.943 1.804 2.013 2.475 3.117.092.156.138.332.138.507s-.046.351-.138.507c-2.068 3.403-5.721 6.493-9.864 6.493-1.298 0-2.553-.313-3.73-.849l2.624-2.307c.352.102.724.156 1.108.156 2.208 0 4-1.792 4-4 0-.206-.016-.408-.046-.606zm-4.932.467c-.678-.528-1.53-.843-2.455-.843-2.208 0-4 1.792-4 4 0 .741.202 1.435.553 2.03l1.16-1.019c-.137-.31-.213-.651-.213-1.011 0-1.38 1.12-2.5 2.5-2.5.474 0 .918.132 1.296.362z"
  );
  pathSvg2.setAttribute("fill-rule", "nonzero");
  iconSvg2.appendChild(pathSvg2);
  divSvg2.appendChild(iconSvg2);
  propContainer.appendChild(divSvg2);

  classessGUI.appendChild(propContainer);
  divSvg.onclick = async () => {
    const currentIcon=divSvg.childNodes[0];
    const isActive=currentIcon.classList.contains('icon-active');

    if (!isActive){
      showOriginal(viewer, model);
      const allIcons=Array.from(document.getElementsByClassName("class-icon"));
      for (const icon of allIcons){
        icon.classList.remove("icon-active");
      }
      const currentIcon=divSvg.childNodes[0];
      currentIcon.classList.add("icon-active");
  
      const txt = divSvg.parentElement.childNodes[0].textContent;
      const filteredIDs = await getObjects(viewer, model.modelID, txt);
      isolate(filteredIDs, viewer, model);
      viewer.IFC.selector.unpickIfcItems();
    }
    else{
      if (selectedSubset) {
        currentIcon.classList.remove("icon-active");
        viewer.IFC.loader.ifcManager.clearSubset(
          model.modelID, 
          "isolated-selection"
        );
        viewer.context.scene.add(model);
        togglePickable(viewer, model,selectedSubset,false);
        viewer.context.renderer.postProduction.update();
        viewer.IFC.selector.unpickIfcItems();
      }
    }
  };

  divSvg2.onclick = async () => {
    const currentIcon=divSvg2.childNodes[0];
    const isActive=currentIcon.classList.contains('icon-active');
    
    if (!isActive){
      const allIcons=Array.from(document.getElementsByClassName("class-icon"));
      for (const icon of allIcons){
        icon.classList.remove("icon-active");
      }
      currentIcon.classList.add("icon-active");
      const txt = divSvg2.parentElement.childNodes[0].textContent;
      const filteredIDs = await getObjects(viewer, model.modelID, txt);
      hide(filteredIDs, viewer, model);
    }
    else{
      currentIcon.classList.remove("icon-active");
      showOriginal(viewer, model);
    }
  };

  keyElement.onclick = async () => {
    const txt = divSvg.parentElement.childNodes[0].textContent;
    console.log(txt);
    const filteredIDs = await getObjects(viewer, model.modelID, txt);
    await viewer.IFC.selector.pickIfcItemsByID(
      model.modelID,
      filteredIDs,
      true,
      true
    );
  };
}

function setupNativeProps(){
  const propsGUI = document.getElementById("ifc-property-menu-root");
  //NATIVE PROPERTIES BUTTON ------------------------------------------------------------------------------------
  const nativePropertiesButton = document.getElementById("btn-properties-native");
  const native_HTML = document.getElementById("native-prop");

  nativePropertiesButton.classList.add("active-btn");
  native_HTML.classList.add("selected");

  nativePropertiesButton.onclick = () => {
    resetPropertiesMenu();
    nativePropertiesBtnActive = !nativePropertiesBtnActive;
    typePropertiesBtnActive = false;
    materialPropertiesBtnActive = false;
    psetsPropertiesBtnActive = false;
  
    if (nativePropertiesBtnActive) {
      nativePropertiesButton.classList.add("active-btn");
      native_HTML.classList.add("selected");
    } else {
      nativePropertiesButton.classList.remove("active-btn");
      native_HTML.classList.remove("selected");
      removeAllChildren(propsGUI);
    }
  };
}

function setupTypeProps(){
  const propsGUI = document.getElementById("ifc-property-menu-root");
  //TYPE PROPERTIES BUTTON ------------------------------------------------------------------------------------
  const typePropertiesButton = document.getElementById("btn-properties-type");
  const type_HTML = document.getElementById("type-prop");

  typePropertiesButton.onclick = () => {
    resetPropertiesMenu();
    typePropertiesBtnActive = !typePropertiesBtnActive;
    nativePropertiesBtnActive = false;
    materialPropertiesBtnActive = false;
    psetsPropertiesBtnActive = false;
    if (typePropertiesBtnActive) {
      typePropertiesButton.classList.add("active-btn");
      type_HTML.classList.add("selected");
    } else {
      typePropertiesButton.classList.remove("active-btn");
      type_HTML.classList.remove("selected");
      removeAllChildren(propsGUI);
    }
  };
}

function setupMaterialProps(){
  const propsGUI = document.getElementById("ifc-property-menu-root");
  //MATERIAL PROPERTIES BUTTON ------------------------------------------------------------------------------------
  const materialPropertiesButton = document.getElementById(
    "btn-properties-material"
  );
  const material_HTML = document.getElementById("material-prop");

  materialPropertiesButton.onclick = () => {
    resetPropertiesMenu();
    materialPropertiesBtnActive = !materialPropertiesBtnActive;
    nativePropertiesBtnActive = false;
    typePropertiesBtnActive = false;
    psetsPropertiesBtnActive = false;
    if (materialPropertiesBtnActive) {
      materialPropertiesButton.classList.add("active-btn");
      material_HTML.classList.add("selected");
    } else {
      materialPropertiesButton.classList.remove("active-btn");
      material_HTML.classList.remove("selected");
      removeAllChildren(propsGUI);
    }
  };
}

function setupPsetsProps(){
  const propsGUI = document.getElementById("ifc-property-menu-root");
  //PSETS PROPERTIES BUTTON ------------------------------------------------------------------------------------
  const psetsPropertiesButton = document.getElementById("btn-properties-psets");
  const psets_HTML = document.getElementById("psets-prop");

  psetsPropertiesButton.onclick = () => {
    resetPropertiesMenu();
    psetsPropertiesBtnActive = !psetsPropertiesBtnActive;
    nativePropertiesBtnActive = false;
    typePropertiesBtnActive = false;
    materialPropertiesBtnActive = false;
    if (psetsPropertiesBtnActive) {
      psetsPropertiesButton.classList.add("active-btn");
      psets_HTML.classList.add("selected");
    } else {
      psetsPropertiesButton.classList.remove("active-btn");
      psets_HTML.classList.remove("selected");
      removeAllChildren(propsGUI);
    }
  };
}

function resetPropertiesMenu() {
  const propsGUI = document.getElementById("ifc-property-menu-root");
  const prop_HTML = document.getElementsByClassName("prop");
  for (const ele of prop_HTML) {
    ele.classList.remove("active-btn");
  }
  const propertyTitles_HTML = document.getElementsByClassName("title-prop");
  for (const ele of propertyTitles_HTML) {
    ele.classList.remove("selected");
  }
  removeAllChildren(propsGUI);
}

function createPropertiesMenu_native(properties) {
  const propsGUI = document.getElementById("ifc-property-menu-root");
  removeAllChildren(propsGUI);

  delete properties.psets;
  delete properties.mats;
  delete properties.type;

  for (let key in properties) {
    createPropertyEntry(key, properties[key]);
  }
}

function createPropertiesMenu_type(properties) {
  const propsGUI = document.getElementById("ifc-property-menu-root");
  removeAllChildren(propsGUI);
  for (let key in properties[0]) {
    createPropertyEntry(key, properties[0][key]);
  }
}

function createPropertiesMenu_material(properties) {
  const propsGUI = document.getElementById("ifc-property-menu-root");
  removeAllChildren(propsGUI);

  for (let ifcMaterialLayerSetUsage of properties) {
    const matLayers = ifcMaterialLayerSetUsage.ForLayerSet.MaterialLayers;
    for (let key1 of matLayers) {
      createPropertyEntry(key1.Material.Name.value, key1.LayerThickness.value);
    }
  }
}

function createPropertiesMenu_pset(properties) {
  const propsGUI = document.getElementById("ifc-property-menu-root");
  removeAllChildren(propsGUI);
  for (let pset of properties) {
    const hasProp = pset.HasProperties;
    if (hasProp != undefined) {
      for (let key1 of hasProp) {
        createPropertyEntry_pset(
          pset.Name.value,
          key1.Name.value,
          key1.NominalValue.value
        );
        //console.log(pset.Name.value+"-"+key1.Name.value+": "+key1.NominalValue.value);
      }
    }
  }
}

function createPropertyEntry_pset(pset, key, value) {
  const propsGUI = document.getElementById("ifc-property-menu-root");
  const container = document.createElement("div");
  container.classList.add("vertical");

  const propContainer = document.createElement("div");
  propContainer.classList.add("ifc-property-item");

  const psetElement = document.createElement("div");
  psetElement.classList.add("pset");
  psetElement.textContent = pset;
  container.appendChild(psetElement);
  const keyElement = document.createElement("div");
  keyElement.textContent = key;
  propContainer.appendChild(keyElement);

  const valueElement = document.createElement("div");
  valueElement.classList.add("ifc-property-value");
  valueElement.textContent = value;
  propContainer.appendChild(valueElement);
  container.appendChild(propContainer);
  propsGUI.appendChild(container);
}

function createPropertyEntry(key, value) {
  const propsGUI = document.getElementById("ifc-property-menu-root");
  const propContainer = document.createElement("div");
  propContainer.classList.add("ifc-property-item");

  if (value === null || value === undefined) value = "undefined";
  else if (value.value) value = value.value;

  const keyElement = document.createElement("div");
  keyElement.textContent = key;
  propContainer.appendChild(keyElement);

  const valueElement = document.createElement("div");
  valueElement.classList.add("ifc-property-value");
  valueElement.textContent = value;
  propContainer.appendChild(valueElement);

  propsGUI.appendChild(propContainer);
}

function removeAllChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

// TREE VIEW -------------------------------------------------------------------------------------
const toggler = document.getElementsByClassName("caret");
for (let i = 0; i < toggler.length; i++) {
  toggler[i].onclick = () => {
    toggler[i].parentElement
      .querySelector(".nested")
      .classList.toggle("active");
    toggler[i].classList.toggle("caret-down");
  };
}

async function createTreeMenu(viewer, ifcProject, modelID) {
  const root = document.getElementById("tree-root");
  removeAllChildren(root);
  const ifcProjectNode = createNestedChild(root, ifcProject);
  ifcProject.children.forEach((child) => {
    constructTreeMenuNode(ifcProjectNode, child, viewer);
  });
  await renameTree(viewer, ifcProject, modelID);
}

async function renameTree(viewer, ifcProject, modelID) {
  const nestedUl = document.getElementsByClassName("caret");
  let filteredUl = [];
  for (const val of nestedUl) {
    const valContent = val.textContent.toString();
    if (
      valContent.includes("IFCPROJECT") ||
      valContent.includes("IFCSITE") ||
      valContent.includes("IFCBUILDING") ||
      valContent.includes("IFCBUILDINGSTOREY")
    ) {
      filteredUl.push(val);
    }
  }
  const project = filteredUl[0];
  project.textContent = await getProjectName(viewer, ifcProject, modelID);
  const site = filteredUl[1];
  site.textContent = await getSiteName(viewer, ifcProject, modelID);
  const building = filteredUl[2];
  building.textContent = await getBuildingName(viewer,ifcProject, modelID);
  const buildingStoreys = Array.from(filteredUl).slice(3);
  const bsNames = await getBuildingStoreyNames(viewer,ifcProject, modelID);
  for (let i = 0; i < buildingStoreys.length; i++) {
    filteredUl[3 + i].textContent = bsNames[i];
  }
}

function nodeToString(node) {
  return `${node.type} - ${node.expressID}`;
}

function constructTreeMenuNode(parent, node, viewer) {
  const children = node.children;
  if (children.length === 0) {
    createSimpleChild(parent, node, viewer);
    return;
  }
  const nodeElement = createNestedChild(parent, node);
  children.forEach((child) => {
    constructTreeMenuNode(nodeElement, child, viewer);
  });
}

function createNestedChild(parent, node) {
  const content = nodeToString(node);
  const root = document.createElement("li");
  createTitle(root, content);
  const childrenContainer = document.createElement("ul");
  childrenContainer.classList.add("nested");
  root.appendChild(childrenContainer);
  parent.appendChild(root);
  return childrenContainer;
}

function createTitle(parent, content) {
  const title = document.createElement("span");
  title.classList.add("caret");
  title.onclick = () => {
    title.parentElement.querySelector(".nested").classList.toggle("active");
    title.classList.toggle("caret-down");
  };
  title.textContent = content;
  parent.appendChild(title);
}

function createSimpleChild(parent, node, viewer) {
  const content = nodeToString(node);
  const childNode = document.createElement("li");
  childNode.classList.add("leaf-node");
  childNode.textContent = content;
  parent.appendChild(childNode);

  childNode.onmouseenter = () => {
    viewer.IFC.selector.prepickIfcItemsByID(0, [node.expressID]);
  };

  childNode.onclick = async () => {
    viewer.IFC.selector.pickIfcItemsByID(0, [node.expressID]);
  };
}

async function getProjectName(viewer, ifcProject, modelID) {
  const ifcProjectID = ifcProject.expressID;
  const ifcProjectProps = await viewer.IFC.loader.ifcManager.getItemProperties(
    modelID,
    ifcProjectID
  );
  const name = ifcProjectProps.Name.value;
  return "IfcProject - " + name;
}

async function getSiteName(viewer, ifcProject, modelID) {
  const ifcSiteID = ifcProject.children[0].expressID;
  const ifcSiteProps = await viewer.IFC.loader.ifcManager.getItemProperties(
    modelID,
    ifcSiteID
  );
  const name = ifcSiteProps.Name.value;
  return "IfcSite - " + name;
}

async function getBuildingName(viewer, ifcProject, modelID) {
  const ifcBuildingID = ifcProject.children[0].children[0].expressID;
  const ifcBuildingProps = await viewer.IFC.loader.ifcManager.getItemProperties(
    modelID,
    ifcBuildingID
  );
  const name = ifcBuildingProps.Name.value;
  return "IfcBuilding - " + name;
}

async function getBuildingStoreyNames(viewer, ifcProject, modelID) {
  const ifcBuildingStoreys = ifcProject.children[0].children[0].children;
  let result = [];
  for (const bs of ifcBuildingStoreys) {
    const id = bs.expressID;
    const props = await viewer.IFC.loader.ifcManager.getItemProperties(
      modelID,
      id
    );
    const name = props.Name.value;
    result.push("IfcBuildingStorey - " + name);
  }
  return result;
}

async function setUpMultiThreading(viewer) {
  const manager = viewer.IFC.loader.ifcManager;
  // These paths depend on how you structure your project
  await manager.useWebWorkers(true, "./IFCWorker.js");
}

function setupProgressNotification(viewer) {
  const text = document.getElementById("progress-text");
  viewer.IFC.loader.ifcManager.setOnProgress((event) => {
    const percent = (event.loaded / event.total) * 100;
    const result = Math.trunc(percent);
    text.innerText = result.toString();
  });
}
