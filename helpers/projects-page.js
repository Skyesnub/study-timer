import { pageState } from "./state.js";
import { db } from "./db.js";

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

courseInput.addEventListener("keydown", async (event) => {
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
                const { data, error } = await db
                    .from("courses")
                    .insert({ name: text })
                    .select()
                    .single();

                if (error) {
                    console.error(error);
                    return;
                }

                coursesArray.push(mapCourseFromDb(data));
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

projectInput.addEventListener("keydown", async (event) => {
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
                const { data, error } = await db
                    .from("projects")
                    .insert({ name: text, course_id: course.id })
                    .select()
                    .single();

                if (error) {
                    console.error(error);
                    return;
                }

                course.projects.push(mapProjectFromDb(data));
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

deleteCourseButton.addEventListener("click", async () => {
    const course = getSelectedCourseForDeletion();
    if (!course) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${course.name}"? This will also delete all of its projects.`);
    if (confirmed) {
        const { error } = await db.from("courses").delete().eq("id", course.id);

        if (error) {
            console.error(error);
            return;
        }

        const idx = coursesArray.findIndex(c => c.id === course.id);
        if (idx !== -1) coursesArray.splice(idx, 1);

        updateCourseDropdown();
        updateCourseNestDropdown();
        updateDropdown();
    }
});

deleteProjectButton.addEventListener("click", async () => {
    const course = getSelectedCourseForDeletion();
    if (!course) return;

    const project = course.projects.find(p => p.id === projectDropdown.value);
    if (!project) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${project.name}"?`);
    if (confirmed) {
        const { error: deleteError } = await db.from("projects").delete().eq("id", project.id);

        if (deleteError) {
            console.error(deleteError);
            return;
        }

        const idx = course.projects.findIndex(p => p.id === project.id);
        if (idx !== -1) course.projects.splice(idx, 1);
        course.totalStudyTime -= project.totalStudyTime;

        // Keep the course's stored total in sync with the project we just removed.
        const { error: updateError } = await db
            .from("courses")
            .update({ total_study_time: course.totalStudyTime })
            .eq("id", course.id);

        if (updateError) {
            console.error(updateError);
        }

        updateDropdown();
    }
});

// Supabase columns are snake_case (total_study_time); the rest of the app
// expects camelCase (totalStudyTime). These map database rows to the same
// object shape the app already used, so nothing else has to change.
function mapProjectFromDb(row) {
    return {
        id: row.id,
        name: row.name,
        totalStudyTime: row.total_study_time,
        sessions: (row.sessions || []).map(mapSessionFromDb)
    };
}

function mapCourseFromDb(row) {
    return {
        id: row.id,
        name: row.name,
        totalStudyTime: row.total_study_time,
        projects: (row.projects || []).map(mapProjectFromDb)
    };
}

function mapSessionFromDb(row) {
    return {
        date: row.date,
        duration: row.duration
    };
}

export async function loadCoursesFromDatabase() {
    const { data, error } = await db
        .from("courses")
        .select("*, projects(*, sessions(*))")
        .order("name", { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    coursesArray.length = 0;
    coursesArray.push(...data.map(mapCourseFromDb));

    updateCourseDropdown();
    updateCourseNestDropdown();
    updateDropdown();
}

export function clearCoursesArray() {
    coursesArray.length = 0;

    updateCourseDropdown();
    updateCourseNestDropdown();
    updateDropdown();
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