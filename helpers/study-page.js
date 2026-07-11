import { pageState, studyBackgroundState, timerState } from "./state.js";
import { enableWakeLock, disableWakeLock } from "./wakelock.js";
import { coursesArray } from "./projects-page.js";
import { glowColorPalette } from "./settings-page.js";
import { db } from "./db.js";

const glowShapeTypes = ["circle", "triangle", "square"];

let mainCanvas;
let mainCtx;
let timerPageContent;
let timerHTML;
let timerClassSelect;
let timerProjectSelect;

// Logical (CSS-pixel) canvas size — kept separate from mainCanvas.width/height,
// which are the physical pixel-buffer dimensions once scaled by devicePixelRatio.
let canvasWidth = 0;
let canvasHeight = 0;

export function initStudyPage(options) {
    mainCanvas = options.mainCanvas;
    mainCtx = options.mainCtx;
    timerPageContent = document.getElementById("timer-page-content");
    timerHTML = document.getElementById("timer");
    timerClassSelect = document.getElementById("timer-page-class-select");
    timerProjectSelect = document.getElementById("timer-page-project-select");

    document.getElementById("pause-timer-button").onclick = () => {
        pauseTimer(); disableWakeLock();
    } 
    document.getElementById("return-timer-button").onclick = () => {
        resumeTimer(); enableWakeLock();
    } 
    document.getElementById("finish-timer-button").onclick = () => {
        finishTimer(); disableWakeLock();
    } 

    timerClassSelect.addEventListener("change", () => {
        updateTimerPageProjectDropdown();
    });

    // In case a session was already running when the page loaded (e.g. a refresh),
    // make sure the selects reflect that by staying locked.
    setSelectionLocked(timerState.running);

    // The canvas is now sized responsively rather than fixed at 1400x700 —
    // ResizeObserver catches window resizes, orientation changes, and layout
    // shifts alike, and redraws whatever should currently be on screen.
    const resizeObserver = new ResizeObserver(() => resizeMainCanvas());
    resizeObserver.observe(mainCanvas);
    resizeMainCanvas();

    updateTimerDisplay();
    updateStudyPageVisibility();

    setInterval(updateTimer, 250);
}

function resizeMainCanvas() {
    const rect = mainCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvasWidth = rect.width;
    canvasHeight = rect.height;

    mainCanvas.width = Math.round(canvasWidth * dpr);
    mainCanvas.height = Math.round(canvasHeight * dpr);
    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (studyBackgroundState.running) {
        drawStudyBackground();
    } else {
        drawNormalMainBackground();
    }
}

export function drawNormalMainBackground() {
    // Idle state is a plain CSS background behind the (now transparent)
    // canvas — this just clears any leftover glow-shape drawing.
    mainCtx.clearRect(0, 0, canvasWidth, canvasHeight);
}

export function updateStudyPageVisibility() {
    const onTimerPage = pageState.currentPage === "timer";

    timerPageContent.classList.toggle("hidden", !onTimerPage);

    if (onTimerPage) {
        updateTimerPageClassDropdown();
        updateTimerPageProjectDropdown();
    }

    updateStudyBackground();
}

export function updateTimerPageClassDropdown() {
    const previouslySelected = timerClassSelect.value;

    timerClassSelect.innerHTML = ""; // Remove old options

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a class";
    placeholder.disabled = true;
    timerClassSelect.appendChild(placeholder);

    for (const course of coursesArray) {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.name;
        timerClassSelect.appendChild(option);
    }

    if (coursesArray.some(course => course.id === previouslySelected)) {
        timerClassSelect.value = previouslySelected;
    } else {
        placeholder.selected = true;
    }
}

export function updateTimerPageProjectDropdown() {
    timerProjectSelect.innerHTML = ""; // Remove old options

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a project";
    placeholder.selected = true;
    placeholder.disabled = true;
    timerProjectSelect.appendChild(placeholder);

    const selectedCourse = coursesArray.find(course => course.id === timerClassSelect.value);
    if (selectedCourse) {
        for (const project of selectedCourse.projects) {
            const option = document.createElement("option");
            option.value = project.id;
            option.textContent = project.name;
            timerProjectSelect.appendChild(option);
        }
    }
}

function setSelectionLocked(locked) {
    timerClassSelect.disabled = locked;
    timerProjectSelect.disabled = locked;
}

async function logStudySession() {
    if (timerState.totalTime <= 0) {
        return; // Nothing meaningful to log
    }

    const course = coursesArray.find(course => course.id === timerClassSelect.value);
    const project = course
        ? course.projects.find(project => project.id === timerProjectSelect.value)
        : undefined;

    if (!course || !project) {
        console.log("No project selected — session was not logged.");
        return;
    }

    const duration = timerState.totalTime;
    const newProjectTotal = project.totalStudyTime + duration;
    const newCourseTotal = course.totalStudyTime + duration;

    const { data: sessionData, error: sessionError } = await db
        .from("sessions")
        .insert({ project_id: project.id, duration: duration })
        .select()
        .single();

    if (sessionError) {
        console.error(sessionError);
        return;
    }

    const { error: projectError } = await db
        .from("projects")
        .update({ total_study_time: newProjectTotal })
        .eq("id", project.id);

    if (projectError) {
        console.error(projectError);
    }

    const { error: courseError } = await db
        .from("courses")
        .update({ total_study_time: newCourseTotal })
        .eq("id", course.id);

    if (courseError) {
        console.error(courseError);
    }

    project.sessions.push({
        id: sessionData.id,
        date: sessionData.date,
        duration: duration
    });
    project.totalStudyTime = newProjectTotal;
    course.totalStudyTime = newCourseTotal;

    console.log(`Logged ${duration.toFixed(1)}s to "${project.name}"`, project);
}

export function redrawStudyPageBackground() {
    if (!studyBackgroundState.running) {
        drawNormalMainBackground();
    }
}

function createGlowShape() {
    return {
        x: Math.random() * canvasWidth,
        y: canvasHeight + Math.random() * canvasHeight,
        shape: glowShapeTypes[Math.floor(Math.random() * glowShapeTypes.length)],
        radius: 22 + Math.random() * 60,
        speed: 0.4 + Math.random() * 0.6,
        color: glowColorPalette[Math.floor(Math.random() * glowColorPalette.length)],
        alpha: 0.28 + Math.random() * 0.28,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.006 + Math.random() * 0.012
    };
}

// --- Glow sprite cache -----------------------------------------------
// The old approach re-ran ctx.shadowBlur (very expensive) on every shape,
// 3 times each, every single animation frame. That's fine for a couple
// shapes but brutal at 40 shapes x 60fps, especially at high device pixel
// ratios. Instead, each (shape type, color) combination — at most 9 —
// is drawn ONCE onto an offscreen canvas with the blur baked in, and every
// frame just stamps that pre-rendered bitmap wherever it needs to go.
// Bitmap stamping (drawImage) is dramatically cheaper than re-blurring
// vector paths every frame.

const SPRITE_BASE_RADIUS = 64;
const SPRITE_PADDING = 3.2; // extra room so the blur halo isn't clipped
const glowSpriteCache = new Map();

function traceShapePath(ctx, shapeType, cx, cy, radius) {
    if (shapeType === "circle") {
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        return;
    }

    const sides = shapeType === "triangle" ? 3 : 4;

    for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
}

function buildGlowSprite(shapeType, color) {
    const spriteRadius = SPRITE_BASE_RADIUS * SPRITE_PADDING;
    const size = Math.ceil(spriteRadius * 2);

    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const spriteCtx = sprite.getContext("2d");
    const cx = size / 2;
    const cy = size / 2;

    spriteCtx.globalCompositeOperation = "lighter";

    const drawLayer = (alpha, shadowBlur, lineWidth) => {
        spriteCtx.save();
        spriteCtx.globalAlpha = alpha;
        spriteCtx.shadowBlur = shadowBlur;
        spriteCtx.shadowColor = color;
        spriteCtx.strokeStyle = color;
        spriteCtx.lineWidth = lineWidth;
        spriteCtx.beginPath();
        traceShapePath(spriteCtx, shapeType, cx, cy, SPRITE_BASE_RADIUS);
        spriteCtx.stroke();
        spriteCtx.restore();
    };

    // A representative blur amount, baked once — this is the one visual
    // trade-off versus the old per-shape random blur (10-26): every shape
    // of a given type/color now shares the same halo softness. It's a
    // subtle difference not worth the performance cost of keeping it random.
    const blur = 18;
    drawLayer(0.18, blur * 4, SPRITE_BASE_RADIUS * 0.4);
    drawLayer(0.35, blur * 2.5, SPRITE_BASE_RADIUS * 0.22);
    drawLayer(1.0, blur * 1.7, SPRITE_BASE_RADIUS * 0.05 + 2);

    return sprite;
}

function getGlowSprite(shapeType, color) {
    const key = shapeType + "|" + color;
    let sprite = glowSpriteCache.get(key);

    if (!sprite) {
        sprite = buildGlowSprite(shapeType, color);
        glowSpriteCache.set(key, sprite);
    }

    return sprite;
}

function drawGlowShapeSprite(shape) {
    const sprite = getGlowSprite(shape.shape, shape.color);
    const spriteRadius = SPRITE_BASE_RADIUS * SPRITE_PADDING;
    const scale = shape.radius / SPRITE_BASE_RADIUS;
    const drawSize = spriteRadius * 2 * scale;

    mainCtx.save();
    mainCtx.globalAlpha = shape.alpha;
    mainCtx.translate(shape.x, shape.y);
    mainCtx.rotate(shape.rotation);
    mainCtx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    mainCtx.restore();
}

function resetGlowShapes() {
    studyBackgroundState.glowShapes = [];

    const shapeCount = canvasWidth < 480 ? 22 : 40;
    for (let i = 0; i < shapeCount; i++) {
        studyBackgroundState.glowShapes.push(createGlowShape());
    }
}

function drawStudyBackground() {
    // The dark study-mode backdrop is a CSS background behind the canvas;
    // the canvas itself only ever holds the glow shapes, drawn on a
    // transparent buffer so they blend with each other, not the page.
    mainCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    mainCtx.globalCompositeOperation = "lighter";

    for (const shape of studyBackgroundState.glowShapes) {
        drawGlowShapeSprite(shape);

        if (!timerState.paused) {
            shape.y -= shape.speed;
            shape.rotation += shape.rotationSpeed;
        }

        if (shape.y + shape.radius < 0) {
            Object.assign(shape, createGlowShape());
            shape.y = canvasHeight + shape.radius;
        }
    }

    mainCtx.globalCompositeOperation = "source-over";
}

function animateStudyBackground() {
    if (!studyBackgroundState.running) {
        return;
    }

    drawStudyBackground();
    studyBackgroundState.animationId = requestAnimationFrame(animateStudyBackground);
}

function updateStudyBackground() {
    const shouldShowStudyBackground = timerState.running && pageState.currentPage === "timer";

    document.body.classList.toggle("study-mode", shouldShowStudyBackground);

    if (shouldShowStudyBackground && !studyBackgroundState.running) {
        studyBackgroundState.running = true;
        resetGlowShapes();
        animateStudyBackground();
    }

    if (!shouldShowStudyBackground && studyBackgroundState.running) {
        studyBackgroundState.running = false;
        cancelAnimationFrame(studyBackgroundState.animationId);
        drawNormalMainBackground();
    }
}

function updateTimerDisplay() {
    timerState.totalHours = Math.floor(timerState.totalTime / 3600);
    timerState.totalMinutes = Math.floor((timerState.totalTime / 60) % 60);
    timerState.totalSeconds = Math.floor(timerState.totalTime % 60);

    const hoursText = String(timerState.totalHours).padStart(2, "0")
    const minutesText = String(timerState.totalMinutes).padStart(2, "0");
    const secondsText = String(timerState.totalSeconds).padStart(2, "0");

    timerHTML.textContent = hoursText + ":" + minutesText + ":" + secondsText;
}

function resumeTimer() {
    if (!timerState.running || timerState.paused) {
        // Only warn on a genuinely fresh start — once running, the selects
        // are locked (see setSelectionLocked below), so a resume-from-pause
        // can't have a different selection than what the warning already
        // covered when the session first started.
        const isFreshStart = !timerState.running;
        const missingSelection = !timerClassSelect.value || !timerProjectSelect.value;

        if (isFreshStart && missingSelection) {
            const confirmed = window.confirm(
                "You haven't selected both a class and a project. If you start now, this session's time won't be saved when you finish. Start anyway?"
            );
            if (!confirmed) {
                return;
            }
        }

        timerState.running = true;
        timerState.paused = false;
        timerState.startTime = Date.now();
        setSelectionLocked(true);
        updateStudyBackground();
    }
}

function pauseTimer() {
    if (timerState.running && !timerState.paused) {
        timerState.savedTime = timerState.totalTime;
        timerState.paused = true;
        timerState.startTime = 0;
        updateTimerDisplay();
        updateStudyBackground();
    }
}

function finishTimer() {
    logStudySession();

    timerState.running = false;
    timerState.paused = false;
    timerState.startTime = 0;
    timerState.savedTime = 0;
    timerState.totalTime = 0;
    setSelectionLocked(false);
    updateTimerDisplay();
    updateStudyBackground();
}

function updateTimer() {
    if (timerState.running && !timerState.paused) {
        timerState.totalTime = timerState.savedTime + ((Date.now() - timerState.startTime) / 1000);
        updateTimerDisplay();
    }
}