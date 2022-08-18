import {projects} from './projects.js';

const projectsContainer=document.getElementById("projects");
const projectCards=Array.from(projectsContainer.children);
//Remove the 'new card'
projectCards.shift();
const templateProjectCard=projectCards[0];
const baseURL='./viewer.html';
for (let project of projects){
    const newCard=templateProjectCard.cloneNode(true);
    const cardTitle=newCard.querySelector('h2');
    cardTitle.textContent=project.name;
    const btn=newCard.querySelector('a');
    const url=baseURL+`?id=${project.id}`;
    btn.href=url;
    projectsContainer.appendChild(newCard);
}
templateProjectCard.remove();



