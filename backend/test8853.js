const axios = require("axios");
const cheerio = require("cheerio");

const URL = "https://www.8853.it/en/london-fixing.html";

async function getLBMAFixings() {
    try {
        console.log("=================================");
        console.log("8853 LBMA GOLD FIXING");
        console.log("=================================\n");

        console.log("Fetching 8853 page...");

        const response = await axios.get(URL, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
            timeout: 15000,
        });

        console.log(`Status: ${response.status}`);

        const $ = cheerio.load(response.data);

        const fixings = [];

        $("table tr").each((index, row) => {
            const cells = $(row)
                .find("th, td")
                .map((i, cell) => $(cell).text().trim())
                .get();

            // We only want rows containing:
            // Date | AM USD/oz | AM EUR/oz | PM USD/oz | PM EUR/oz
            if (
                cells.length >= 5 &&
                /^\d{4}-\d{2}-\d{2}$/.test(cells[0])
            ) {
                const date = cells[0];

                const amUsd = cells[1];
                const pmUsd = cells[3];

                fixings.push({
                    date,
                    am_usd_oz: amUsd || null,
                    pm_usd_oz: pmUsd || null,
                });
            }
        });

        console.log("\nLBMA GOLD FIXINGS");
        console.log("---------------------------------");

        fixings.forEach((fixing) => {
            console.log(
                `${fixing.date} | AM: ${fixing.am_usd_oz || "Not published"} | PM: ${fixing.pm_usd_oz || "Not published"}`
            );
        });

        console.log("---------------------------------");
        console.log(`Total dates found: ${fixings.length}`);

        // Find the latest date that has at least one published fixing
        const latestPublished = fixings.find(
            (fixing) =>
                fixing.am_usd_oz !== null ||
                fixing.pm_usd_oz !== null
        );

        console.log("\nLATEST PUBLISHED FIXING");
        console.log("---------------------------------");

        if (latestPublished) {
            console.log(`Date : ${latestPublished.date}`);
            console.log(`AM   : ${latestPublished.am_usd_oz || "Not published"}`);
            console.log(`PM   : ${latestPublished.pm_usd_oz || "Not published"}`);
        } else {
            console.log("No published fixing found.");
        }

        console.log("\n=================================");
        console.log("TEST COMPLETED");
        console.log("=================================");

    } catch (error) {
        console.error("\nERROR:");

        if (error.response) {
            console.error(`HTTP Status: ${error.response.status}`);
        } else {
            console.error(error.message);
        }
    }
}

getLBMAFixings();