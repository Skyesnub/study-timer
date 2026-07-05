import { pageState } from "./state.js";

const mainCanvas = document.getElementById("main");
const mainCtx = mainCanvas.getContext("2d");

export let coursesArray = []

let projectsPageContent = document.getElementById("projects-page-content")
let noRepeatWarning = document.getElementById("no-repeat-warning")
let noRepeatCourseWarning = document.getElementById("no-repeat-course-warning")

const projectDropdown = document.getElementById("project-dropdown");
const projectInput = document.getElementById("project-input");

const courseDropdown = document.getElementById("course-dropdown");
const courseInput = document.getElementById("course-input");

const courseNestInput = document.getElementById("project-nest-input");

const deleteCourseButton = document.getElementById("delete-course-button");
const deleteProjectButton = document.getElementById("delete-project-button");

courseInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        const text = courseInput.value.trim();

        if (text) {
            let repeated = false;
            for (const course of coursesArray) {
                if (text === course.name) {
                    repeated = true;
                }
            }
            if (!repeated) {
                coursesArray.push(createCourseObject(text));
                updateCourseDropdown();
                updateCourseNestDropdown();
                courseInput.value = "";
            } else {
                console.log("Please do not repeat.")
                noRepeatCourseWarning.classList.remove("hidden")
            }
        }
    }
});

projectInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        const text = projectInput.value.trim();
        const course = getSelectedCourseForNesting();

        if (!course) {
            console.log("Please select a course to nest this project in first.")
            return;
        }

        if (text) {
            let repeated = false;
            for (const project of course.projects) {
                if (text === project.name) {
                    repeated = true;
                }
            }
            if (!repeated) {
                course.projects.push(createProjectObject(text));
                updateDropdown();
                projectInput.value = "";
            } else {
                console.log("Please do not repeat.")
                noRepeatWarning.classList.remove("hidden") //add the html element warning
            }

        }
    }
});

courseDropdown.addEventListener("change", () => {
    updateDropdown();
});

deleteCourseButton.addEventListener("click", () => {
    const course = getSelectedCourseForDeletion();
    if (!course) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${course.name}"? This will also delete all of its projects.`);
    if (confirmed) {
        const idx = coursesArray.findIndex(c => c.id === course.id);
        if (idx !== -1) coursesArray.splice(idx, 1);

        updateCourseDropdown();
        updateCourseNestDropdown();
        updateDropdown();
    }
});

deleteProjectButton.addEventListener("click", () => {
    const course = getSelectedCourseForDeletion();
    if (!course) return;

    const project = course.projects.find(p => p.id === projectDropdown.value);
    if (!project) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${project.name}"?`);
    if (confirmed) {
        const idx = course.projects.findIndex(p => p.id === project.id);
        if (idx !== -1) course.projects.splice(idx, 1);

        updateDropdown();
    }
});

function createCourseObject(title) {
    return {
        id: crypto.randomUUID(),
        name: title,
        projects: []
    }
}

function createProjectObject(title) {
    return {
        id: crypto.randomUUID(),
        name: title,
        totalStudyTime: 0,
        sessions: []
    }
}

function getSelectedCourseForNesting() {
    const courseId = courseNestInput.value;
    return coursesArray.find(course => course.id === courseId);
}

function getSelectedCourseForDeletion() {
    const courseId = courseDropdown.value;
    return coursesArray.find(course => course.id === courseId);
}

export function updateCourseDropdown() {
    const previouslySelected = courseDropdown.value;

    courseDropdown.innerHTML = ""; // Remove old options

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a course";
    placeholder.disabled = true;
    courseDropdown.appendChild(placeholder);
    noRepeatCourseWarning.classList.add("hidden")

    for (const course of coursesArray) {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.name;
        courseDropdown.appendChild(option);
    }

    if (coursesArray.some(course => course.id === previouslySelected)) {
        courseDropdown.value = previouslySelected;
    } else {
        placeholder.selected = true;
    }

    console.log(coursesArray)
}

export function updateCourseNestDropdown() {
    const previouslySelected = courseNestInput.value;

    courseNestInput.innerHTML = ""; // Remove old options

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Nest project in...";
    placeholder.disabled = true;
    courseNestInput.appendChild(placeholder);

    for (const course of coursesArray) {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.name;
        courseNestInput.appendChild(option);
    }

    if (coursesArray.some(course => course.id === previouslySelected)) {
        courseNestInput.value = previouslySelected;
    } else {
        placeholder.selected = true;
    }
}

export function updateDropdown() {
    projectDropdown.innerHTML = ""; // Remove old options

    // Placeholder
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a project";
    placeholder.selected = true;
    placeholder.disabled = true;
    projectDropdown.appendChild(placeholder);
    noRepeatWarning.classList.add("hidden")

    const course = getSelectedCourseForDeletion();
    if (course) {
        for (const project of course.projects) {
            const option = document.createElement("option");
            option.value = project.id;
            option.textContent = project.name;
            projectDropdown.appendChild(option);
        }
    }
    console.log(course ? course.projects : [])
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

// Populate placeholders on initial load
updateCourseDropdown();
updateCourseNestDropdown();
updateDropdown();