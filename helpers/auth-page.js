import { db } from "./db.js";
import { loadCoursesFromDatabase, clearCoursesArray } from "./projects-page.js";

const emailInput = document.getElementById("auth-email-input");
const passwordInput = document.getElementById("auth-password-input");
const submitButton = document.getElementById("auth-submit-button");
const toggleModeButton = document.getElementById("auth-toggle-mode-button");
const authError = document.getElementById("auth-error-message");
const authHeading = document.getElementById("auth-heading");
const signOutButton = document.getElementById("sign-out-button");

let mode = "sign-in"; // or "sign-up"

function setMode(newMode) {
    mode = newMode;
    hideMessage();

    if (mode === "sign-in") {
        authHeading.textContent = "Log in";
        submitButton.textContent = "Log in";
        toggleModeButton.textContent = "Need an account? Sign up";
    } else {
        authHeading.textContent = "Sign up";
        submitButton.textContent = "Sign up";
        toggleModeButton.textContent = "Already have an account? Log in";
    }
}

function showError(message) {
    authError.textContent = message;
    authError.classList.remove("hidden", "auth-notice");
    authError.classList.add("auth-error");
}

function showNotice(message) {
    authError.textContent = message;
    authError.classList.remove("hidden", "auth-error");
    authError.classList.add("auth-notice");
}

function hideMessage() {
    authError.classList.add("hidden");
}

toggleModeButton.addEventListener("click", () => {
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
});

submitButton.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError("Please enter an email and password.");
        return;
    }

    submitButton.disabled = true;

    const { data, error } = mode === "sign-in"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password });

    submitButton.disabled = false;

    if (error) {
        showError(error.message);
        return;
    }

    if (mode === "sign-up" && !data.session) {
        // Email confirmation is turned on for this project — there's no
        // session yet until the user clicks the link in their inbox.
        showNotice("Account created — check your email to confirm, then log in.");
        setMode("sign-in");
    }
});

signOutButton.addEventListener("click", () => {
    db.auth.signOut();
});

db.auth.onAuthStateChange((event, session) => {
    const loggedIn = !!session;

    document.body.classList.toggle("logged-out", !loggedIn);

    if (loggedIn) {
        emailInput.value = "";
        passwordInput.value = "";
        loadCoursesFromDatabase();
    } else {
        // Make sure the next person to use this browser doesn't see
        // whatever the previous person had loaded.
        clearCoursesArray();
    }
});