const { execFile } = require("child_process");
const path = require("path");

/*
=========================================================
AURIFY LBMA BACKEND POLLING SCHEDULER
=========================================================

PURPOSE:
Check the 8853 London Fixing source every 10 minutes.

IMPORTANT:
The backend polling schedule is NOT the official
London fixing schedule.

Official fixing times are handled by the FRONTEND:

AM FIX -> 10:30 London
PM FIX -> 15:00 London

The backend simply checks the source periodically because
we do not know exactly when 8853 publishes the updated
AM/PM value.

Backend:
    Run immediately
    ↓
    Every 10 minutes
    ↓
    Fetch 8853
    ↓
    Save latest data to MongoDB

Frontend:
    AM countdown -> 10:30 London
    PM countdown -> 15:00 London
=========================================================
*/

const INTERVAL = 10 * 60 * 1000; // 10 minutes

let isRunning = false;

/*
=========================================================
RUN LBMA DATA UPDATE
=========================================================
*/

function runScraper() {
    if (isRunning) {
        console.log("");
        console.log(
            "Previous LBMA update is still running."
        );
        console.log(
            "Skipping this cycle."
        );
        return;
    }

    isRunning = true;

    console.log("");
    console.log(
        "=============================================="
    );
    console.log(
        "Starting scheduled LBMA source check"
    );
    console.log(
        "=============================================="
    );

    console.log(
        "Time:",
        new Date().toLocaleString(
            "en-GB",
            {
                timeZone: "Europe/London",
            }
        )
    );

    console.log(
        "London timezone: Europe/London"
    );

    console.log(
        "Checking source: 8853"
    );

    console.log(
        "=============================================="
    );
    console.log("");

    const scriptPath = path.join(
        __dirname,
        "saveFixings.js"
    );

    execFile(
        process.execPath,
        [scriptPath],
        (error, stdout, stderr) => {

            if (error) {
                console.error(
                    "Scheduled LBMA update failed ❌"
                );

                console.error(
                    error.message
                );
            } else {
                console.log(
                    stdout
                );

                console.log(
                    "LBMA source check completed successfully ✅"
                );
            }

            if (stderr) {
                console.error(
                    stderr
                );
            }

            isRunning = false;

            console.log(
                "Next LBMA source check will run in 10 minutes."
            );

            console.log("");
        }
    );
}

/*
=========================================================
START SCHEDULER
=========================================================
*/

console.log("");
console.log(
    "=============================================="
);
console.log(
    "Aurify LBMA Backend Scheduler"
);
console.log(
    "=============================================="
);

console.log(
    "Backend polling interval: 10 minutes"
);

console.log(
    "Source: 8853 London Fixing"
);

console.log(
    "Frontend official AM fixing: 10:30 London"
);

console.log(
    "Frontend official PM fixing: 15:00 London"
);

console.log(
    "=============================================="
);
console.log("");

/*
Run once when backend starts.
This makes sure MongoDB has the latest
available source data immediately.
*/

runScraper();

/*
Then check 8853 every 10 minutes.
*/

setInterval(
    runScraper,
    INTERVAL
);

console.log(
    "LBMA 10-minute polling scheduler started. ⏱️"
);