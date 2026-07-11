import { pageState } from "./state.js";
import { db } from "./db.js";

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
const renameCourseButton = document.getElementById("rename-course-button");
const renameProjectButton = document.getElementById("rename-project-button");

const sessionsList = document.getElementById("sessions-list");
const sessionDateInput = document.getElementById("session-date-input");
const sessionDurationInput = document.getElementById("session-duration-input");
const sessionWarning = document.getElementById("session-warning");
const addSessionButton = document.getElementById("add-session-button");

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
    const course = getSelectedManagedCourse();
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
    const course = getSelectedManagedCourse();
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

renameCourseButton.addEventListener("click", async () => {
    const course = getSelectedManagedCourse();
    if (!course) return;

    const newName = window.prompt("Rename course:", course.name);
    if (newName === null) return; // cancelled

    const trimmed = newName.trim();
    if (!trimmed || trimmed === course.name) return;

    const repeated = coursesArray.some(c => c.id !== course.id && c.name === trimmed);
    if (repeated) {
        window.alert("Another course already has that name.");
        return;
    }

    const { error } = await db.from("courses").update({ name: trimmed }).eq("id", course.id);
    if (error) {
        console.error(error);
        return;
    }

    course.name = trimmed;
    updateCourseDropdown();
    updateCourseNestDropdown();
    updateDropdown();
});

renameProjectButton.addEventListener("click", async () => {
    const course = getSelectedManagedCourse();
    if (!course) return;

    const project = course.projects.find(p => p.id === projectDropdown.value);
    if (!project) return;

    const newName = window.prompt("Rename project:", project.name);
    if (newName === null) return; // cancelled

    const trimmed = newName.trim();
    if (!trimmed || trimmed === project.name) return;

    const repeated = course.projects.some(p => p.id !== project.id && p.name === trimmed);
    if (repeated) {
        window.alert("This course already has a project with that name.");
        return;
    }

    const { error } = await db.from("projects").update({ name: trimmed }).eq("id", project.id);
    if (error) {
        console.error(error);
        return;
    }

    project.name = trimmed;
    updateDropdown();
});

projectDropdown.addEventListener("change", () => {
    renderSessionsList();
});

addSessionButton.addEventListener("click", async () => {
    const course = getSelectedManagedCourse();
    const project = course ? course.projects.find(p => p.id === projectDropdown.value) : undefined;

    if (!project) {
        sessionWarning.classList.remove("hidden");
        return;
    }
    sessionWarning.classList.add("hidden");

    const minutes = parseFloat(sessionDurationInput.value);
    if (!minutes || minutes <= 0) {
        return;
    }

    // Only a date is collected (not a time), so pin it to midday to avoid
    // timezone conversion shifting it onto the wrong calendar day when
    // displayed back.
    const dateValue = sessionDateInput.value;
    const isoDate = dateValue
        ? new Date(dateValue + "T12:00:00").toISOString()
        : new Date().toISOString();

    const duration = Math.round(minutes * 60);

    const { data, error: insertError } = await db
        .from("sessions")
        .insert({ project_id: project.id, duration: duration, date: isoDate })
        .select()
        .single();

    if (insertError) {
        console.error(insertError);
        return;
    }

    const newProjectTotal = project.totalStudyTime + duration;
    const newCourseTotal = course.totalStudyTime + duration;

    const { error: projectError } = await db
        .from("projects")
        .update({ total_study_time: newProjectTotal })
        .eq("id", project.id);
    if (projectError) console.error(projectError);

    const { error: courseError } = await db
        .from("courses")
        .update({ total_study_time: newCourseTotal })
        .eq("id", course.id);
    if (courseError) console.error(courseError);

    project.sessions.push(mapSessionFromDb(data));
    project.totalStudyTime = newProjectTotal;
    course.totalStudyTime = newCourseTotal;

    sessionDurationInput.value = "";
    renderSessionsList();
});

async function deleteSession(course, project, session) {
    if (!session.id) {
        console.error("Cannot delete a session with no id — try reloading first.");
        return;
    }

    const confirmed = window.confirm("Delete this study session? This can't be undone.");
    if (!confirmed) return;

    const { error: deleteError } = await db.from("sessions").delete().eq("id", session.id);
    if (deleteError) {
        console.error(deleteError);
        return;
    }

    const newProjectTotal = project.totalStudyTime - session.duration;
    const newCourseTotal = course.totalStudyTime - session.duration;

    const { error: projectError } = await db
        .from("projects")
        .update({ total_study_time: newProjectTotal })
        .eq("id", project.id);
    if (projectError) console.error(projectError);

    const { error: courseError } = await db
        .from("courses")
        .update({ total_study_time: newCourseTotal })
        .eq("id", course.id);
    if (courseError) console.error(courseError);

    const idx = project.sessions.findIndex(s => s.id === session.id);
    if (idx !== -1) project.sessions.splice(idx, 1);
    project.totalStudyTime = newProjectTotal;
    course.totalStudyTime = newCourseTotal;

    renderSessionsList();
}

function formatSessionDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatSessionDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds / 60) % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function renderSessionsList() {
    sessionsList.innerHTML = "";

    const course = getSelectedManagedCourse();
    const project = course ? course.projects.find(p => p.id === projectDropdown.value) : undefined;

    addSessionButton.disabled = !project;

    if (!project) {
        const placeholder = document.createElement("p");
        placeholder.id = "sessions-placeholder";
        placeholder.textContent = "Select a project above to add or remove sessions.";
        sessionsList.appendChild(placeholder);
        return;
    }

    if (project.sessions.length === 0) {
        const empty = document.createElement("p");
        empty.id = "sessions-placeholder";
        empty.textContent = "No sessions logged yet for this project.";
        sessionsList.appendChild(empty);
        return;
    }

    const sortedSessions = [...project.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));

    for (const session of sortedSessions) {
        const row = document.createElement("div");
        row.classList.add("session-row");

        const info = document.createElement("div");
        info.classList.add("session-info");

        const dateLine = document.createElement("span");
        dateLine.classList.add("session-date");
        dateLine.textContent = formatSessionDate(session.date);

        const durationLine = document.createElement("span");
        durationLine.classList.add("session-duration");
        durationLine.textContent = formatSessionDuration(session.duration);

        info.appendChild(dateLine);
        info.appendChild(durationLine);

        const deleteButton = document.createElement("button");
        deleteButton.classList.add("session-delete-button");
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteSession(course, project, session));

        row.appendChild(info);
        row.appendChild(deleteButton);
        sessionsList.appendChild(row);
    }
}

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
        id: row.id,
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

function getSelectedManagedCourse() {
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
    const previouslySelected = projectDropdown.value;

    projectDropdown.innerHTML = ""; // Remove old options

    // Placeholder
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a project";
    placeholder.disabled = true;
    projectDropdown.appendChild(placeholder);
    noRepeatWarning.classList.add("hidden")

    const course = getSelectedManagedCourse();
    const projects = course ? course.projects : [];

    for (const project of projects) {
        const option = document.createElement("option");
        option.value = project.id;
        option.textContent = project.name;
        projectDropdown.appendChild(option);
    }

    if (projects.some(project => project.id === previouslySelected)) {
        projectDropdown.value = previouslySelected;
    } else {
        placeholder.selected = true;
    }

    console.log(course ? course.projects : [])
    renderSessionsList();
}

export function updateProjectsPageVisibility() {
    const onProjectsPage = pageState.currentPage === "projects";

    projectsPageContent.classList.toggle("hidden", !onProjectsPage);
}

// Populate placeholders on initial load
updateCourseDropdown();
updateCourseNestDropdown();
updateDropdown();
sessionDateInput.valueAsDate = new Date();