const { execFile } = require("child_process");
const path = require("path");

const INTERVAL = 30 * 60 * 1000; // 30 minutes

let isRunning = false;

function runScraper() {
    if (isRunning) {
        console.log(
            "Previous LBMA update is still running. Skipping this cycle."
        );
        return;
    }

    isRunning = true;

    console.log("");
    console.log("======================================");
    console.log("Starting scheduled LBMA source check");
    console.log("Time:", new Date().toLocaleString());
    console.log("======================================");
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
                console.error(error.message);
            } else {
                console.log(stdout);
                console.log(
                    "LBMA source check completed successfully ✅"
                );
            }

            if (stderr) {
                console.error(stderr);
            }

            isRunning = false;

            console.log(
                "Next LBMA source check will run in 30 minutes."
            );
        }
    );
}

// Run once when the backend starts
runScraper();

// Then run every 30 minutes
setInterval(
    runScraper,
    INTERVAL
);

console.log("");
console.log("======================================");
console.log("LBMA SCHEDULER STARTED");
console.log("======================================");
console.log("Source: Al Abyad");
console.log("Interval: 30 minutes");
console.log("======================================");