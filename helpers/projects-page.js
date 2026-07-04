import { pageState } from "./state.js";

const mainCanvas = document.getElementById("main");
const mainCtx = mainCanvas.getContext("2d");

export let projectsArray = []

let projectsPageContent = document.getElementById("projects-page-content")
let noRepeatWarning = document.getElementById("no-repeat-warning")

const dropdown = document.getElementById("project-dropdown");
const input = document.getElementById("project-input");

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        const text = input.value.trim();

        if (text) {
            let repeated = false;
            for (const project of projectsArray) {
                if (text === project) {
                    repeated = true;
                }
            }
            if (!repeated) {
                projectsArray.push(createProjectObject(text));
                updateDropdown();
                input.value = "";
            } else {
                console.log("Please do not repeat.")
                noRepeatWarning.classList.remove("hidden") //add the html element warning
            }

        }
    }
});

function createProjectObject(title) {
    return {
        id: crypto.randomUUID(),
        name: title,
        totalStudyTime: 0,
        sessions: []
    }
}
export function updateDropdown() {
    dropdown.innerHTML = ""; // Remove old options

    // Placeholder
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a project";
    placeholder.selected = true;
    placeholder.disabled = true;
    dropdown.appendChild(placeholder);
    noRepeatWarning.classList.add("hidden")

    for (const project of projectsArray) {
        const option = document.createElement("option");
        option.value = project.id;
        option.textContent = project.name;
        dropdown.appendChild(option);
    } 
    console.log(projectsArray)
}

export function updateProjectsPageVisibility() {
    const onProjectsPage = pageState.currentPage === "projects";

    projectsPageContent.classList.toggle("hidden", !onProjectsPage);
}

export function drawLineSeparator() {
    if (pageState.currentPage === "projects") {
        mainCtx.beginPath();
        mainCtx.moveTo(700, 0);
        mainCtx.lineTo(700, 700);
        mainCtx.lineWidth = 2;
        mainCtx.strokeStyle = "black";
        mainCtx.stroke();
    }

}
