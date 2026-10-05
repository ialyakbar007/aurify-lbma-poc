const { execFile } = require("child_process");
const path = require("path");

const SCRIPT_PATH = path.join(__dirname, "saveFixings.js");

// --------------------------------------------------
// LBMA schedule - Europe/London
// --------------------------------------------------

const SCHEDULE = [
    {
        hour: 10,
        minute: 35,
        name: "AM FIX"
    },
    {
        hour: 10,
        minute: 40,
        name: "AM FIX RETRY"
    },
    {
        hour: 15,
        minute: 5,
        name: "PM FIX"
    },
    {
        hour: 15,
        minute: 10,
        name: "PM FIX RETRY"
    }
];

let isRunning = false;
let lastRunKey = null;

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
// Run saveFixings.js
// --------------------------------------------------

function runScraper(scheduleName) {
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
            } else {
                console.log(
                    `${scheduleName} completed successfully ✅`
                );
            }

            console.log("");
        }
    );
}

// --------------------------------------------------
// Check current schedule
// --------------------------------------------------

function checkSchedule() {
    const london = getLondonTime();

    const {
        year,
        month,
        day,
        hour,
        minute
    } = london;

    // Skip Saturday and Sunday
    if (!isWeekday(year, month, day)) {
        return;
    }

    for (const event of SCHEDULE) {

        if (
            hour === event.hour &&
            minute === event.minute
        ) {

            const runKey =
                `${year}-${month}-${day}-` +
                `${event.hour}-${event.minute}`;

            // Prevent multiple executions during
            // the same scheduled minute
            if (lastRunKey === runKey) {
                return;
            }

            lastRunKey = runKey;

            console.log(
                `\nScheduled event detected: ${event.name}`
            );

            runScraper(event.name);

            return;
        }
    }
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
console.log("AM FIX:       10:35 London");
console.log("AM RETRY:     10:40 London");
console.log("PM FIX:       15:05 London");
console.log("PM RETRY:     15:10 London");
console.log("");
console.log("Weekends:     Skipped");
console.log("======================================");
console.log("Scheduler is running...");
console.log("======================================");
console.log("");

// Check once immediately
// --------------------------------------------------
// Manual test mode
// --------------------------------------------------

// Check once immediately
checkSchedule();

// Check every second for scheduled minute
setInterval(checkSchedule, 1000);