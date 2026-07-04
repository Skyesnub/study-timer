import { pageState, studyBackgroundState, timerState } from "./state.js";
import { enableWakeLock, disableWakeLock } from "./wakelock.js";

const glowColors = [
    "#60a5fa",
    "#a78bfa",
    "#cabeecff",
    "#f472b6",
    "#a5e2ccff",
    "#81ddbbff",
    "#f0df9dff",
    "#fb7185",
    "#22d3ee"
];

const glowShapeTypes = ["circle", "triangle", "square"];

let mainCanvas;
let mainCtx;
let timerPageContent;
let timerHTML;

export function initStudyPage(options) {
    mainCanvas = options.mainCanvas;
    mainCtx = options.mainCtx;
    timerPageContent = document.getElementById("timer-page-content");
    timerHTML = document.getElementById("timer");

    document.getElementById("pause-timer-button").onclick = () => {
        pauseTimer(); disableWakeLock();
    } 
    document.getElementById("return-timer-button").onclick = () => {
        resumeTimer(); enableWakeLock();
    } 
    document.getElementById("finish-timer-button").onclick = () => {
        finishTimer(); disableWakeLock();
    } 

    updateTimerDisplay();
    updateStudyPageVisibility();

    setInterval(updateTimer, 250);
}

export function drawNormalMainBackground() {
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.fillStyle = "#e2e0f1ff";
    mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
}

export function updateStudyPageVisibility() {
    const onTimerPage = pageState.currentPage === "timer";

    timerPageContent.classList.toggle("hidden", !onTimerPage);
    updateStudyBackground();
}

export function redrawStudyPageBackground() {
    if (!studyBackgroundState.running) {
        drawNormalMainBackground();
    }
}

function createGlowShape() {
    return {
        x: Math.random() * mainCanvas.width,
        y: mainCanvas.height + Math.random() * mainCanvas.height,
        shape: glowShapeTypes[Math.floor(Math.random() * glowShapeTypes.length)],
        radius: 35 + Math.random() * 95,
        speed: 0.5 + Math.random() * 0.75,
        blur: 14 + Math.random() * 22,
        color: glowColors[Math.floor(Math.random() * glowColors.length)],
        alpha: 0.28 + Math.random() * 0.28,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.006 + Math.random() * 0.012
    };
}

function drawGlowShape(shape) {
    if (shape.shape === "circle") {
        mainCtx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        return;
    }

    const sides = shape.shape === "triangle" ? 3 : 4;

    for (let i = 0; i <= sides; i++) {
        const angle = shape.rotation + (i / sides) * Math.PI * 2;
        const x = shape.x + Math.cos(angle) * shape.radius;
        const y = shape.y + Math.sin(angle) * shape.radius;

        if (i === 0) {
            mainCtx.moveTo(x, y);
        } else {
            mainCtx.lineTo(x, y);
        }
    }
}

function drawRoundedRect(x, y, width, height, radius) {
    mainCtx.beginPath();
    mainCtx.moveTo(x + radius, y);
    mainCtx.lineTo(x + width - radius, y);
    mainCtx.quadraticCurveTo(x + width, y, x + width, y + radius);
    mainCtx.lineTo(x + width, y + height - radius);
    mainCtx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    mainCtx.lineTo(x + radius, y + height);
    mainCtx.quadraticCurveTo(x, y + height, x, y + height - radius);
    mainCtx.lineTo(x, y + radius);
    mainCtx.quadraticCurveTo(x, y, x + radius, y);
    mainCtx.closePath();
}

function drawTimerButtonBackplate() {
    let width = 225;
    let height = 100;
    let x = (mainCanvas.width - width) / 2;
    let y = 315;

    mainCtx.save();
    mainCtx.globalCompositeOperation = "source-over";
    mainCtx.fillStyle = "rgba(186, 180, 229, 0.7)";
    mainCtx.shadowBlur = 24;
    mainCtx.shadowColor = "rgba(226, 224, 241, 0.45)";
    drawRoundedRect(x, y, width, height, 26);
    mainCtx.fill();
    mainCtx.restore();

    mainCtx.save();
    width = 235;
    height = 110;
    x = (mainCanvas.width - width) / 2;
    y = 310;
    mainCtx.fillStyle = "rgba(186, 180, 229, 0.4)";
    drawRoundedRect(x, y, width, height, 26);
    mainCtx.fill();
    mainCtx.restore();
}

function resetGlowShapes() {
    studyBackgroundState.glowShapes = [];

    for (let i = 0; i < 40; i++) {
        studyBackgroundState.glowShapes.push(createGlowShape());
    }
}

function drawStudyBackground() {
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.fillStyle = "#030407";
    mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.globalCompositeOperation = "lighter";

    for (const shape of studyBackgroundState.glowShapes) {
        drawGlowingOutline(shape, shape.alpha * 0.18, shape.blur * 4, 34);
        drawGlowingOutline(shape, shape.alpha * 0.35, shape.blur * 2.5, 18);
        drawGlowingOutline(shape, shape.alpha, shape.blur * 1.7, 3);

        if (!timerState.paused) {
            shape.y -= shape.speed;
            shape.rotation += shape.rotationSpeed;
        }

        if (shape.y + shape.radius < 0) {
            Object.assign(shape, createGlowShape());
            shape.y = mainCanvas.height + shape.radius;
        }
    }

    mainCtx.globalCompositeOperation = "source-over";
    drawTimerButtonBackplate();
}

function drawGlowingOutline(shape, alpha, shadowBlur, lineWidth) {
    mainCtx.save();
    mainCtx.globalAlpha = alpha;
    mainCtx.shadowBlur = shadowBlur;
    mainCtx.shadowColor = shape.color;
    mainCtx.strokeStyle = shape.color;
    mainCtx.lineWidth = lineWidth;
    mainCtx.beginPath();
    drawGlowShape(shape);
    mainCtx.stroke();
    mainCtx.restore();
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
        timerState.running = true;
        timerState.paused = false;
        timerState.startTime = Date.now();
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
    timerState.running = false;
    timerState.paused = false;
    timerState.startTime = 0;
    timerState.savedTime = 0;
    timerState.totalTime = 0;
    updateTimerDisplay();
    updateStudyBackground();
}

function updateTimer() {
    if (timerState.running && !timerState.paused) {
        timerState.totalTime = timerState.savedTime + ((Date.now() - timerState.startTime) / 1000);
        updateTimerDisplay();
    }
}
