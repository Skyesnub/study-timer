import { pageState, studyBackgroundState } from "./state.js";

// Hue (in degrees) for each rainbow color. Feel free to nudge these —
// they're just artistic placement around the color wheel, not exact science.
const RAINBOW_COLORS = {
    red: 0,
    orange: 28,
    yellow: 52,
    green: 135,
    blue: 212,
    indigo: 245,
    violet: 280
};

const COLOR_LABELS = {
    red: "Red",
    orange: "Orange",
    yellow: "Yellow",
    green: "Green",
    blue: "Blue",
    indigo: "Indigo",
    violet: "Violet"
};

// This module's own references to the canvases it needs to repaint when
// the theme changes. Getting a context for a canvas that's already in use
// elsewhere is safe — it returns the same context object, not a new one.
const mainCanvas = document.getElementById("main");
const mainCtx = mainCanvas.getContext("2d");
const sidebarCanvas = document.getElementById("sidebar");
const sidebarCtx = sidebarCanvas.getContext("2d");
const topbarCanvas = document.getElementById("topbar");
const topbarCtx = topbarCanvas.getContext("2d");

const settingsPageContent = document.getElementById("settings-page-content");
const shapeColorSelect = document.getElementById("shape-color-select");
const themeColorSelect = document.getElementById("theme-color-select");

export const settingsState = {
    shapeColor: "blue",
    themeColor: "indigo"
};

// Consumed by study-page.js when a new glow shape is created.
export let glowColorPalette = [];

// Consumed by study-page.js when drawing the idle background and the
// timer button backplate.
export let themeColors = {
    background: "",
    sidebar: "",
    topbar: "",
    backplateStrong: "",
    backplateSoft: "",
    backplateGlow: ""
};

function buildShapeShades(hue) {
    return [
        `hsl(${hue}, 78%, 45%)`, // deep
        `hsl(${hue}, 78%, 60%)`, // medium
        `hsl(${hue}, 78%, 75%)`  // light
    ];
}

function buildThemeColors(hue) {
    return {
        background: `hsl(${hue}, 34%, 91%)`,
        sidebar: `hsl(${hue}, 24%, 62%)`,
        topbar: `hsl(${hue}, 35%, 94%)`,
        backplateStrong: `hsla(${hue}, 46%, 80%, 0.7)`,
        backplateSoft: `hsla(${hue}, 46%, 80%, 0.4)`,
        backplateGlow: `hsla(${hue}, 46%, 92%, 0.45)`
    };
}

function applyShapeColor(colorName) {
    settingsState.shapeColor = colorName;

    const hue = RAINBOW_COLORS[colorName];
    const shades = buildShapeShades(hue);

    glowColorPalette.length = 0;
    glowColorPalette.push(...shades);

    // Recolor shapes already on screen so the change is visible right away,
    // rather than waiting for each one to naturally recycle.
    for (const shape of (studyBackgroundState.glowShapes || [])) {
        shape.color = glowColorPalette[Math.floor(Math.random() * glowColorPalette.length)];
    }
}

function applyThemeColor(colorName) {
    settingsState.themeColor = colorName;

    const hue = RAINBOW_COLORS[colorName];
    Object.assign(themeColors, buildThemeColors(hue));

    // Sidebar and topbar are canvases painted once at startup in main.js,
    // not styled via CSS, so repaint them directly here.
    sidebarCtx.fillStyle = themeColors.sidebar;
    sidebarCtx.fillRect(0, 0, sidebarCanvas.width, sidebarCanvas.height);

    topbarCtx.fillStyle = themeColors.topbar;
    topbarCtx.fillRect(0, 0, topbarCanvas.width, topbarCanvas.height);

    // If the idle (non-study) background is what's currently showing,
    // repaint it now so the new theme is visible immediately. This mirrors
    // drawNormalMainBackground() in study-page.js — kept separate here
    // deliberately, to avoid a circular import between the two files.
    if (!studyBackgroundState.running) {
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        mainCtx.fillStyle = themeColors.background;
        mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
    }
}

function populateColorSelect(selectEl, selectedValue) {
    selectEl.innerHTML = "";

    for (const colorName of Object.keys(RAINBOW_COLORS)) {
        const option = document.createElement("option");
        option.value = colorName;
        option.textContent = COLOR_LABELS[colorName];
        selectEl.appendChild(option);
    }

    selectEl.value = selectedValue;
}

shapeColorSelect.addEventListener("change", () => {
    applyShapeColor(shapeColorSelect.value);
});

themeColorSelect.addEventListener("change", () => {
    applyThemeColor(themeColorSelect.value);
});

export function updateSettingsPageVisibility() {
    const onSettingsPage = pageState.currentPage === "settings";

    settingsPageContent.classList.toggle("hidden", !onSettingsPage);
}

// Set up the dropdowns and compute the initial palette/theme so both are
// ready before study-page.js needs them.
populateColorSelect(shapeColorSelect, settingsState.shapeColor);
populateColorSelect(themeColorSelect, settingsState.themeColor);
applyShapeColor(settingsState.shapeColor);
applyThemeColor(settingsState.themeColor);
