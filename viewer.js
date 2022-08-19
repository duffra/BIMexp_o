import { projects } from "./projects.js";
import { Color } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";

import { IFCPROJECT, IFCSITE, IFCBUILDINGSTOREY, IFCBUILDING } from "web-ifc";

window.document.body.style.overflow = "hidden";
const currentURL = window.location.href;
url = new URL(currentURL);
const currentProjectID = url.searchParams.get("id");
let currentProject;

const container = document.getElementById("viewer-container");
const viewer = new IfcViewerAPI({
  container,
  backgroundColor: new Color(0xffffff),
});
viewer.grid.setGrid();
viewer.axes.setAxes();
setUpMultiThreading();

if (currentProjectID === "0") {
  const input = document.getElementById("custom-file-upload");
  input.style.visibility = "visible";
  const title = document.getElementById("project-title");
  title.innerHTML = "Your project";
  input.addEventListener(
    "change",
    async (changed) => {
      const ifcURL = URL.createObjectURL(changed.target.files[0]);
      loadIfc(ifcURL);
    },
    false
  );
} else {
  /*const currentProject=projects.find(project=>{
        project.id===currentProjectID;
    })*/ //DOES NOT WORK (?!)
  for (p of projects) {
    if (p.id === currentProjectID) {
      currentProject = p;
    }
  }
  console.log(projects.id);
  console.log(
    typeof currentProjectID + " vs " + " currentID= " + currentProjectID
  );
  console.log("currentProject= " + currentProject);

  const title = document.getElementById("project-title");
  title.innerHTML = currentProject.name;
  const currentPath = currentProject.path;
  loadIfc(currentPath);
}

async function loadIfc(url) {
  await viewer.IFC.setWasmPath("../");
  const model = await viewer.IFC.loadIfcUrl(url);
  // Add dropped shadow and post-processing efect
  await viewer.shadowDropper.renderShadow(model.modelID);
  viewer.context.renderer.postProduction.active = true;
  const ifcProject = await viewer.IFC.getSpatialStructure(model.modelID);
  //console.log("Treeview= " + JSON.stringify(ifcProject));
  await createTreeMenu(ifcProject, model.modelID);
}
window.ondblclick = async () => await viewer.IFC.selector.pickIfcItem();
window.onmousemove = async () => await viewer.IFC.selector.prePickIfcItem();

const backBtn=document.getElementById("btn-back");
backBtn.onclick=()=>{
  viewer.dispose();
  window.open("./index.html","_self");
}

async function releaseMemory() {
  // This releases all IFCLoader memory
  await viewwr.IFC.ifcLoader.ifcManager.dispose()//ifcLoader.ifcManager.dispose();
  ifcLoader = null;
  ifcLoader = new IFCLoader();

  // If the wasm path was set before, we need to reset it
  await ifcLoader.ifcManager.setWasmPath('../');

  // If IFC models are an array or object,
  // you must release them there as well
  // Otherwise, they won't be garbage collected
  models.length = 0;
}
//HIDE BUTTON ----------------------------------------------------------------------------------------
async function hide() {
  window.ondblclick = async () => {
    const selected = await viewer.IFC.selector.pickIfcItem();
    let selectedIDs = [];
    try {
      selectedIDs.push(selected.id);
      console.log("selectedId is: " + selectedIDs);
      const scene = viewer.context.getScene();
      const selectedSubset = viewer.IFC.loader.ifcManager.createSubset({
        modelID: 0,
        scene,
        ids: [selected.id],
        removePrevious: true,
      });
      console.log("selectedSubset: " + selectedSubset);
      selectedSubset.removeFromParent();
    } catch {}
  };
}
const hideButton = document.getElementById("btn-hide");
let hideBtnActive = false;
hideButton.onclick = async () => {
  hideBtnActive = !hideBtnActive;
  if (hideBtnActive) {
    hideButton.classList.add("active-btn");
  } else {
    hideButton.classList.remove("active-btn");
  }
  await hide();
};
//ISOLATE BUTTON ----------------------------------------------------------------------------------------
const isolateButton = document.getElementById("btn-isolate");
let isolateBtnActive = false;
isolateButton.onclick = () => {
  isolateBtnActive = !isolateBtnActive;
  if (isolateBtnActive) {
    isolateButton.classList.add("active-btn");
  } else {
    isolateButton.classList.remove("active-btn");
  }
  window.ondblclick = () => {
    console.log("isolate");
    viewer.IFC.selector.highlightIfcItem(true, false, true);
  };
};

//CLIP BUTTON
const sectionButton = document.getElementById("btn-section");
let sectionBtnActive = false;
sectionButton.onclick=()=>{
  sectionBtnActive = !sectionBtnActive;
  if (sectionBtnActive) {
    sectionButton.classList.add("active-btn");
  } else {
    sectionButton.classList.remove("active-btn");
  }
  viewer.clipper.active=sectionBtnActive;
  window.ondblclick=()=>{
    viewer.clipper.createPlane();
  }
  window.onkeydown =(event)=>{
    if(event.keyCode == 8){
      viewer.clipper.deletePlane();
    }
  }
}

//PROPERTIES (FOR EVERY PROP TYPE)
const propsGUI = document.getElementById("ifc-property-menu-root");
let nativePropertiesBtnActive = false;
let typePropertiesBtnActive = false;
let materialPropertiesBtnActive=false;
let psetsPropertiesBtnActive = false;
//NATIVE PROPERTIES BUTTON ------------------------------------------------------------------------------------
const nativePropertiesButton = document.getElementById("btn-properties-native");
const native_HTML = document.getElementById("native-prop");

function resetPropertiesMenu(){
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

nativePropertiesButton.onclick = () => {
  resetPropertiesMenu();
  nativePropertiesBtnActive = !nativePropertiesBtnActive;
  if (nativePropertiesBtnActive) {
    nativePropertiesButton.classList.add("active-btn");
    native_HTML.classList.add("selected");
  } else {
    nativePropertiesButton.classList.remove("active-btn");
    native_HTML.classList.remove("selected");
    removeAllChildren(propsGUI);
  }
  
  // Properties menu
  window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
  window.onclick = async () => {
    viewer.IFC.selector.unpickIfcItems();
    const result = await viewer.IFC.selector.pickIfcItem();
    if (!result) return;
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id)//,true, false);
    try{
      createPropertiesMenu_native(props);
    }
    catch{
      removeAllChildren(propsGUI);
    }
  };
};

//TYPE PROPERTIES BUTTON ------------------------------------------------------------------------------------
const typePropertiesButton = document.getElementById("btn-properties-type");
const type_HTML = document.getElementById("type-prop");

typePropertiesButton.onclick = () => {
  resetPropertiesMenu();
  typePropertiesBtnActive = !typePropertiesBtnActive;
  if (typePropertiesBtnActive) {
    typePropertiesButton.classList.add("active-btn");
    type_HTML.classList.add("selected");
  } else {
    typePropertiesButton.classList.remove("active-btn");
    type_HTML.classList.remove("selected");
    removeAllChildren(propsGUI);
  }
  
  // Properties menu
  window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
  window.onclick = async () => {
    viewer.IFC.selector.unpickIfcItems();
    const result = await viewer.IFC.selector.pickIfcItem();
    if (!result) return;
    const { modelID, id } = result;
    const props_type= await viewer.IFC.loader.ifcManager.getTypeProperties(modelID,id,true);
    try{
      createPropertiesMenu_type(props_type);
    }
    catch{
      removeAllChildren(propsGUI);
    }
  };
};

//MATERIAL PROPERTIES BUTTON ------------------------------------------------------------------------------------
const materialPropertiesButton = document.getElementById("btn-properties-material");
const material_HTML = document.getElementById("material-prop");

materialPropertiesButton.onclick = () => {
  resetPropertiesMenu();
  materialPropertiesBtnActive = !materialPropertiesBtnActive;
  if (materialPropertiesBtnActive) {
    materialPropertiesButton.classList.add("active-btn");
    material_HTML.classList.add("selected");
  } else {
    materialPropertiesButton.classList.remove("active-btn");
    material_HTML.classList.remove("selected");
    removeAllChildren(propsGUI);
  }
  
  // Properties menu
  window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
  window.onclick = async () => {
    viewer.IFC.selector.unpickIfcItems();
    const result = await viewer.IFC.selector.pickIfcItem();
    if (!result) return;
    const { modelID, id } = result;
    const props_material= await viewer.IFC.loader.ifcManager.getMaterialsProperties(modelID,id,true);
    try{
      createPropertiesMenu_material(props_material);
    }
    catch{
      removeAllChildren(propsGUI);
    }
  };
};

//PSETS PROPERTIES BUTTON ------------------------------------------------------------------------------------
const psetsPropertiesButton = document.getElementById("btn-properties-psets");
const psets_HTML = document.getElementById("psets-prop");

psetsPropertiesButton.onclick = () => {
  resetPropertiesMenu();
  psetsPropertiesBtnActive = !psetsPropertiesBtnActive;
  if (psetsPropertiesBtnActive) {
    psetsPropertiesButton.classList.add("active-btn");
    psets_HTML.classList.add("selected");
  } else {
    psetsPropertiesButton.classList.remove("active-btn");
    psets_HTML.classList.remove("selected");
    removeAllChildren(propsGUI);
  }
  
  // Properties menu
  window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
  window.onclick = async () => {
    viewer.IFC.selector.unpickIfcItems();
    const result = await viewer.IFC.selector.pickIfcItem();
    if (!result) return;
    const { modelID, id } = result;
    const props_psets=await viewer.IFC.loader.ifcManager.getPropertySets(modelID,id,true);
    try{
      createPropertiesMenu_pset(props_psets);
    }
    catch{
      removeAllChildren(propsGUI);
    }
  };
};

function createPropertiesMenu_native(properties) {
  console.log("native props: " + properties);

  removeAllChildren(propsGUI);

  delete properties.psets;
  delete properties.mats;
  delete properties.type;

  for (let key in properties) {
    createPropertyEntry(key, properties[key]);
  }
}

function createPropertiesMenu_type(properties) {
  console.log("other props: " + properties);

  removeAllChildren(propsGUI);

  for (let key in properties) {
    createPropertyEntry(key, properties[key]);
  }
}

function createPropertiesMenu_material(properties) {
  console.log("mat props: " + properties);
  removeAllChildren(propsGUI);

  for (let ifcMaterialLayerSetUsage of properties) {
    const matLayers=ifcMaterialLayerSetUsage.ForLayerSet.MaterialLayers;
    for (let key1 of matLayers){
      createPropertyEntry(key1.Material.Name.value, key1.LayerThickness.value);
    }
    //createPropertyEntry(key, properties[key]);
  }
}

function createPropertiesMenu_pset(properties) {
  //console.log("psets props: " + properties);

  removeAllChildren(propsGUI);
  for (let pset of properties){
    const hasProp=pset.HasProperties;
    for (let key1 of hasProp) {
      createPropertyEntry_pset(pset.Name.value, key1.Name.value, key1.NominalValue.value);
      //console.log(pset.Name.value+"-"+key1.Name.value+": "+key1.NominalValue.value);
    }
  }
}

function createPropertyEntry_pset(pset, key, value) {
  const container = document.createElement("div");
  container.classList.add("vertical");

  const propContainer = document.createElement("div");
  propContainer.classList.add("ifc-property-item");

  /*if (value === null || value === undefined) value = "undefined";
  else if (value.value) value = value.value;*/

  const psetElement = document.createElement("div");
  psetElement.classList.add("pset");
  psetElement.textContent = pset;
  container.appendChild(psetElement)
  const keyElement = document.createElement("div");
  keyElement.textContent = key;
  propContainer.appendChild(keyElement);

  const valueElement = document.createElement("div");
  valueElement.classList.add("ifc-property-value");
  valueElement.textContent = value;
  propContainer.appendChild(valueElement);
  container.appendChild(propContainer);
  //propsGUI.appendChild(propContainer);
  propsGUI.appendChild(container);
}

function createPropertyEntry(key, value) {
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

// Tree view

const toggler = document.getElementsByClassName("caret");
for (let i = 0; i < toggler.length; i++) {
    toggler[i].onclick = () => {
        toggler[i].parentElement.querySelector(".nested").classList.toggle("active");
        toggler[i].classList.toggle("caret-down");
    }
}

// Spatial tree menu

/*function createTreeMenu(ifcProject) {
    const root = document.getElementById("tree-root");
    removeAllChildren(root);
    const ifcProjectNode = createNestedChild(root, ifcProject);
    ifcProject.children.forEach(child => {
        constructTreeMenuNode(ifcProjectNode, child);
    })
}*/

async function createTreeMenu(ifcProject,modelID) {
  const root = document.getElementById("tree-root");
  removeAllChildren(root);
  const ifcProjectNode = createNestedChild(root, ifcProject);
  ifcProject.children.forEach(child => {
      constructTreeMenuNode(ifcProjectNode, child);
  })
  await renameTree(ifcProject,modelID);
}

function reorderTree(){
  const leaves=document.getElementsByClassName("leaf-node");
  let ifcClasses=[];
  for (const leaf of leaves){
    const text = leaf.textContent.split(" - ")[0];
    ifcClasses.push(text);
  }
  const single_ifcClasses=[...new Set(ifcClasses)];
  //leaves.remove();
  for (const ifcClass in single_ifcClasses){

  }
}

async function renameTree(ifcProject, modelID){
  const nestedUl = document.getElementsByClassName("caret");
  let filteredUl=[];
  for(const val of nestedUl){
    const valContent=val.textContent.toString();
    if (valContent.includes("IFCPROJECT") || valContent.includes("IFCSITE") || valContent.includes("IFCBUILDING") || valContent.includes("IFCBUILDINGSTOREY")){
      filteredUl.push(val);
    };
  };
  const project = filteredUl[0];
  project.textContent=await getProjectName(ifcProject,modelID);
  const site =filteredUl[1];
  site.textContent=await getSiteName(ifcProject,modelID);
  const building = filteredUl[2];
  building.textContent=await getBuildingName(ifcProject,modelID);
  const buildingStoreys=Array.from(filteredUl).slice(3);
  const bsNames=await getBuildingStoreyNames(ifcProject,modelID);
  for (let i = 0; i < buildingStoreys.length; i++){
    filteredUl[3+i].textContent=bsNames[i];
  }
}

function nodeToString(node) {
    return `${node.type} - ${node.expressID}`
}

function constructTreeMenuNode(parent, node) {
    const children = node.children;
    if (children.length === 0) {
        createSimpleChild(parent, node);
        return;
    }
    const nodeElement = createNestedChild(parent, node);
    children.forEach(child => {
        constructTreeMenuNode(nodeElement, child);
    })
}

function createNestedChild(parent, node) {
    const content = nodeToString(node);
    const root = document.createElement('li');
    createTitle(root, content);
    const childrenContainer = document.createElement('ul');
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
    }
    title.textContent = content;
    parent.appendChild(title);
}

function createSimpleChild(parent, node) {
    const content = nodeToString(node);
    const childNode = document.createElement('li');
    childNode.classList.add('leaf-node');
    childNode.textContent = content;
    parent.appendChild(childNode);

    childNode.onmouseenter = () => {
        viewer.IFC.selector.prepickIfcItemsByID(0, [node.expressID]);
    }

    childNode.onclick = async () => {
        viewer.IFC.selector.pickIfcItemsByID(0, [node.expressID]);
    }
}

async function getProjectName(ifcProject, modelID){
  const ifcProjectID=ifcProject.expressID;
  const ifcProjectProps = await viewer.IFC.loader.ifcManager.getItemProperties(modelID,ifcProjectID);
  const name=ifcProjectProps.Name.value;
  return "IfcProject - "+name;
}

async function getSiteName(ifcProject,modelID){
  const ifcSiteID=ifcProject.children[0].expressID;
  const ifcSiteProps = await viewer.IFC.loader.ifcManager.getItemProperties(modelID,ifcSiteID);
  const name=ifcSiteProps.Name.value;
  return "IfcSite - "+name;
}

async function getBuildingName(ifcProject,modelID){
  const ifcBuildingID=ifcProject.children[0].children[0].expressID;
  const ifcBuildingProps = await viewer.IFC.loader.ifcManager.getItemProperties(modelID,ifcBuildingID);
  const name=ifcBuildingProps.Name.value;
  return "IfcBuilding - "+name;
}

async function getBuildingStoreyNames(ifcProject,modelID){
  const ifcBuildingStoreys=ifcProject.children[0].children[0].children;
  let result=[];
  for (const bs of ifcBuildingStoreys){
    const id=bs.expressID;
    const props=await viewer.IFC.loader.ifcManager.getItemProperties(modelID,id);
    const name=props.Name.value;
    result.push("IfcBuildingStorey - "+name);
  }
  return result;
}

async function setUpMultiThreading() {
  const manager = viewer.IFC.loader.ifcManager;
  // These paths depend on how you structure your project
  await manager.useWebWorkers(true, '../IFCWorker.js');
}



/*
//TO DO ------------!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
1 OK - dispose quando torno nella gallery
2 OK - Multithreading
3 - treeview raggruppata per classi
4 - prop native già attive al caricamento. ripeti il comando nella window.onclick esterna, aggiungendo if nativeactive=true (gli altri restano col pulsante)
5 - Progress text
*/