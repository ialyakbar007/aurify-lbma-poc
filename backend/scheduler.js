const { execFile } = require("child_process");
const path = require("path");

const INTERVAL = 10 * 60 * 1000; // 10 minutes

let isRunning = false;

function runScraper() {
    if (isRunning) {
        console.log("Previous update is still running. Skipping this cycle.");
        return;
    }

    isRunning = true;

    console.log("\n======================================");
    console.log("Starting scheduled LBMA data update");
    console.log("Time:", new Date().toLocaleString());
    console.log("======================================\n");

    const scriptPath = path.join(__dirname, "saveFixings.js");

    execFile(process.execPath, [scriptPath], (error, stdout, stderr) => {

        if (error) {
            console.error("Scheduled update failed ❌");
            console.error(error.message);
        } else {
            console.log(stdout);
        }

        if (stderr) {
            console.error(stderr);
        }

        isRunning = false;

        console.log("Next update will run in 10 minutes.");
    });
}

// Run once immediately
runScraper();

// Then run every 10 minutes
setInterval(runScraper, INTERVAL);

console.log("LBMA scheduler started. ⏱️");
console.log("Update interval: 10 minutes");