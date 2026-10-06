const { execFile } = require("child_process");
const path = require("path");

const SCRIPT_PATH = path.join(__dirname, "saveFixings.js");

// --------------------------------------------------
// LBMA schedule - Europe/London
// --------------------------------------------------

const AM_START_HOUR = 10;
const AM_START_MINUTE = 35;

const PM_START_HOUR = 15;
const PM_START_MINUTE = 5;

// Retry interval
const RETRY_INTERVAL_MINUTES = 30;

let isRunning = false;

// Track whether today's AM / PM fixing has already
// been successfully obtained.
let amFixFound = false;
let pmFixFound = false;

// Track the last retry slot executed
let lastAMRunKey = null;
let lastPMRunKey = null;

// Track the London date so state resets each day
let currentLondonDate = null;

// --------------------------------------------------
// Get current London time
// --------------------------------------------------

function getLondonTime() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());

    const values = {};

    for (const part of parts) {
        if (part.type !== "literal") {
            values[part.type] = part.value;
        }
    }

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        hour: Number(values.hour),
        minute: Number(values.minute),
        second: Number(values.second)
    };
}

// --------------------------------------------------
// Check whether London date is weekday
// --------------------------------------------------

function isWeekday(year, month, day) {
    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    const weekday = date.getUTCDay();

    return weekday !== 0 && weekday !== 6;
}

// --------------------------------------------------
// Get London date key
// --------------------------------------------------

function getDateKey(london) {
    return (
        `${london.year}-` +
        `${String(london.month).padStart(2, "0")}-` +
        `${String(london.day).padStart(2, "0")}`
    );
}

// --------------------------------------------------
// Convert current time to minutes from midnight
// --------------------------------------------------

function getMinutesFromMidnight(hour, minute) {
    return hour * 60 + minute;
}

// --------------------------------------------------
// Check whether a fixing has been successfully parsed
// --------------------------------------------------

function fixingWasFound(stdout, fixingType) {

    if (!stdout) {
        return false;
    }

    const normalized = stdout.toUpperCase();

    if (fixingType === "AM") {

        return (
            normalized.includes("AM FIX:") &&
            normalized.includes("PM FIX:")
        );
    }

    if (fixingType === "PM") {

        return (
            normalized.includes("PM FIX:")
        );
    }

    return false;
}

// --------------------------------------------------
// Run saveFixings.js
// --------------------------------------------------

function runScraper(fixingType, scheduleName) {

    if (isRunning) {

        console.log(
            `[${new Date().toISOString()}] ` +
            `Previous scraper is still running. ` +
            `Skipping ${scheduleName}.`
        );

        return;
    }

    isRunning = true;

    console.log("");
    console.log("======================================");
    console.log(`RUNNING ${scheduleName}`);
    console.log("======================================");

    console.log(
        "London time:",
        new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/London",
            dateStyle: "medium",
            timeStyle: "medium"
        }).format(new Date())
    );

    console.log("======================================");
    console.log("");

    execFile(
        process.execPath,
        [SCRIPT_PATH],
        {
            cwd: __dirname
        },
        (error, stdout, stderr) => {

            isRunning = false;

            if (stdout) {
                console.log(stdout);
            }

            if (stderr) {
                console.error(stderr);
            }

            if (error) {

                console.error(
                    `Scheduled ${scheduleName} failed ❌`
                );

                console.error(error.message);

                console.log(
                    `${fixingType} fixing not confirmed. ` +
                    `Will retry in 30 minutes.`
                );

                return;
            }

            // --------------------------------------------------
            // Determine whether the required fixing was found
            // --------------------------------------------------

            const found = fixingWasFound(
                stdout,
                fixingType
            );

            if (found) {

                if (fixingType === "AM") {
                    amFixFound = true;
                }

                if (fixingType === "PM") {
                    pmFixFound = true;
                }

                console.log("");
                console.log(
                    `✅ ${fixingType} FIX FOUND`
                );

                console.log(
                    `${fixingType} retry cycle stopped.`
                );

                console.log("");

            } else {

                console.log("");
                console.log(
                    `⚠️ ${fixingType} FIX NOT FOUND`
                );

                console.log(
                    "Al Abyad may not have published " +
                    "today's fixing yet."
                );

                console.log(
                    "Next check will be in 30 minutes."
                );

                console.log("");
            }
        }
    );
}

// --------------------------------------------------
// Reset daily state
// --------------------------------------------------

function resetDailyState(dateKey) {

    if (currentLondonDate === dateKey) {
        return;
    }

    currentLondonDate = dateKey;

    amFixFound = false;
    pmFixFound = false;

    lastAMRunKey = null;
    lastPMRunKey = null;

    console.log("");
    console.log("======================================");
    console.log("NEW LONDON FIXING DAY");
    console.log("======================================");
    console.log(`London date: ${dateKey}`);
    console.log("AM status: Waiting");
    console.log("PM status: Waiting");
    console.log("======================================");
    console.log("");
}

// --------------------------------------------------
// Calculate retry slot
// --------------------------------------------------

function getRetrySlot(
    currentMinutes,
    startMinutes
) {

    if (currentMinutes < startMinutes) {
        return null;
    }

    const elapsed =
        currentMinutes - startMinutes;

    const retryNumber =
        Math.floor(
            elapsed / RETRY_INTERVAL_MINUTES
        );

    return (
        startMinutes +
        retryNumber * RETRY_INTERVAL_MINUTES
    );
}

// --------------------------------------------------
// Check AM fixing
// --------------------------------------------------

function checkAM(london) {

    if (amFixFound) {
        return;
    }

    const currentMinutes =
        getMinutesFromMidnight(
            london.hour,
            london.minute
        );

    const startMinutes =
        getMinutesFromMidnight(
            AM_START_HOUR,
            AM_START_MINUTE
        );

    const retrySlot =
        getRetrySlot(
            currentMinutes,
            startMinutes
        );

    if (retrySlot === null) {
        return;
    }

    const slotHour =
        Math.floor(retrySlot / 60);

    const slotMinute =
        retrySlot % 60;

    const runKey =
        `${currentLondonDate}-AM-${retrySlot}`;

    if (lastAMRunKey === runKey) {
        return;
    }

    lastAMRunKey = runKey;

    console.log("");
    console.log(
        `AM retry slot reached: ` +
        `${String(slotHour).padStart(2, "0")}:` +
        `${String(slotMinute).padStart(2, "0")} London`
    );

    runScraper(
        "AM",
        "AM FIX / 30-MIN RETRY"
    );
}

// --------------------------------------------------
// Check PM fixing
// --------------------------------------------------

function checkPM(london) {

    if (pmFixFound) {
        return;
    }

    const currentMinutes =
        getMinutesFromMidnight(
            london.hour,
            london.minute
        );

    const startMinutes =
        getMinutesFromMidnight(
            PM_START_HOUR,
            PM_START_MINUTE
        );

    const retrySlot =
        getRetrySlot(
            currentMinutes,
            startMinutes
        );

    if (retrySlot === null) {
        return;
    }

    const slotHour =
        Math.floor(retrySlot / 60);

    const slotMinute =
        retrySlot % 60;

    const runKey =
        `${currentLondonDate}-PM-${retrySlot}`;

    if (lastPMRunKey === runKey) {
        return;
    }

    lastPMRunKey = runKey;

    console.log("");
    console.log(
        `PM retry slot reached: ` +
        `${String(slotHour).padStart(2, "0")}:` +
        `${String(slotMinute).padStart(2, "0")} London`
    );

    runScraper(
        "PM",
        "PM FIX / 30-MIN RETRY"
    );
}

// --------------------------------------------------
// Main schedule check
// --------------------------------------------------

function checkSchedule() {

    const london = getLondonTime();

    const {
        year,
        month,
        day
    } = london;

    // --------------------------------------------------
    // Skip Saturday and Sunday
    // --------------------------------------------------

    if (!isWeekday(year, month, day)) {
        return;
    }

    // --------------------------------------------------
    // Reset state when London date changes
    // --------------------------------------------------

    const dateKey =
        getDateKey(london);

    resetDailyState(dateKey);

    // --------------------------------------------------
    // Check AM
    // --------------------------------------------------

    checkAM(london);

    // --------------------------------------------------
    // Check PM
    // --------------------------------------------------

    checkPM(london);
}

// --------------------------------------------------
// Startup
// --------------------------------------------------

console.log("");
console.log("======================================");
console.log("AURIFY LBMA SCHEDULER");
console.log("======================================");
console.log("Source: Al Abyad");
console.log("Timezone: Europe/London");
console.log("");
console.log("AM FIX START:  10:35 London");
console.log("AM RETRY:      Every 30 minutes");
console.log("");
console.log("PM FIX START:  15:05 London");
console.log("PM RETRY:      Every 30 minutes");
console.log("");
console.log("Stop condition:");
console.log("Today's fixing must be found.");
console.log("");
console.log("Weekends:      Skipped");
console.log("======================================");
console.log("Scheduler is running...");
console.log("======================================");
console.log("");

// --------------------------------------------------
// Check once immediately
// --------------------------------------------------

checkSchedule();

// --------------------------------------------------
// Check every second for the correct retry slot
// --------------------------------------------------

setInterval(checkSchedule, 1000);