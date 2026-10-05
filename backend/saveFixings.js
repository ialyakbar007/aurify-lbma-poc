require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const pool = require("./db");

const SOURCE_URL =
    "https://www.alabyadjewellers.com/bullion/en/live-rate";

function extractPrice(value) {
    if (!value) return null;

    const match = value.match(
        /^\s*([\d,]+(?:\.\d+)?)/
    );

    if (!match) return null;

    const number = Number(
        match[1].replace(/,/g, "")
    );

    return Number.isFinite(number)
        ? number
        : null;
}

function extractDate(value) {
    if (!value) return null;

    const match = value.match(
        /(\d{2})-(\d{2})-(\d{4})/
    );

    if (!match) return null;

    const day = match[1];
    const month = match[2];
    const year = match[3];

    return `${year}-${month}-${day}`;
}

function getLondonDate() {
    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Europe/London",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(new Date());
}

async function fetchLatestFixing() {

    console.log(
        "Fetching fixing from Al Abyad..."
    );

    const response = await axios.get(
        SOURCE_URL,
        {
            timeout: 15000,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
                "Accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        }
    );

    console.log(
        `Al Abyad response status: ${response.status}`
    );

    const $ = cheerio.load(response.data);

    const todayLondon =
        getLondonDate();

    console.log(
        `Today's London fixing date: ${todayLondon}`
    );

    let amFix = null;
    let pmFix = null;

    $("table").each(
        (tableIndex, table) => {

            if (
                amFix !== null &&
                pmFix !== null
            ) {
                return;
            }

            const tableText = $(table)
                .text()
                .replace(/\s+/g, " ")
                .trim();

            if (
                !tableText.includes(
                    "GOLD AM Fix"
                ) ||
                !tableText.includes(
                    "GOLD PM Fix"
                )
            ) {
                return;
            }

            console.log(
                "Found Al Abyad LBMA fixing table."
            );

            $(table)
                .find("tr")
                .each(
                    (rowIndex, row) => {

                        const cells = $(row)
                            .find("td")
                            .map(
                                (i, cell) =>
                                    $(cell)
                                        .text()
                                        .replace(
                                            /\s+/g,
                                            " "
                                        )
                                        .trim()
                            )
                            .get();

                        if (
                            cells.length < 2
                        ) {
                            return;
                        }

                        const amPrice =
                            extractPrice(
                                cells[0]
                            );

                        const amDate =
                            extractDate(
                                cells[0]
                            );

                        const pmPrice =
                            extractPrice(
                                cells[1]
                            );

                        const pmDate =
                            extractDate(
                                cells[1]
                            );

                        if (
                            amPrice === null &&
                            pmPrice === null
                        ) {
                            return;
                        }

                        console.log(
                            "\nAl Abyad fixing row:"
                        );

                        console.log(cells);

                        console.log(
                            `AM price: ${amPrice}`
                        );

                        console.log(
                            `AM date: ${amDate}`
                        );

                        console.log(
                            `PM price: ${pmPrice}`
                        );

                        console.log(
                            `PM date: ${pmDate}`
                        );

                        // Accept AM only if
                        // its own date is today
                        if (
                            amPrice !== null &&
                            amDate ===
                                todayLondon
                        ) {
                            amFix = {
                                price: amPrice,
                                date: amDate
                            };
                        }

                        // Accept PM only if
                        // its own date is today
                        if (
                            pmPrice !== null &&
                            pmDate ===
                                todayLondon
                        ) {
                            pmFix = {
                                price: pmPrice,
                                date: pmDate
                            };
                        }
                    }
                );
        }
    );

    console.log(
        "\n======================================"
    );

    console.log(
        "AL ABYAD PARSED RESULT"
    );

    console.log(
        "======================================"
    );

    console.log(
        `London Date: ${todayLondon}`
    );

    if (amFix) {
        console.log(
            `AM FIX: ${amFix.price}`
        );
    } else {
        console.log(
            "AM FIX: Not available for today"
        );
    }

    if (pmFix) {
        console.log(
            `PM FIX: ${pmFix.price}`
        );
    } else {
        console.log(
            "PM FIX: Not available for today"
        );
    }

    return {
        date: todayLondon,

        am_usd_oz:
            amFix
                ? amFix.price
                : null,

        pm_usd_oz:
            pmFix
                ? pmFix.price
                : null
    };
}

async function saveLatestFixing(
    fixing
) {

    console.log(
        "\nConnecting to PostgreSQL..."
    );

    // Check existing record
    const existingResult =
        await pool.query(
            `
            SELECT
                date,
                am_usd_oz,
                pm_usd_oz,
                source
            FROM lbma_fixings
            WHERE date = $1
            `,
            [fixing.date]
        );

    const existing =
        existingResult.rows[0];

    console.log(
        "\nExisting today's record:"
    );

    if (existing) {

        console.log(
            `Date: ${existing.date}`
        );

        console.log(
            `AM: ${existing.am_usd_oz ?? "null"}`
        );

        console.log(
            `PM: ${existing.pm_usd_oz ?? "null"}`
        );

        console.log(
            `Source: ${existing.source ?? "unknown"}`
        );

    } else {

        console.log(
            "No record exists for today."
        );
    }

    /*
     * If today's AM is available,
     * update AM.
     *
     * If today's PM is available,
     * update PM.
     *
     * Existing historical dates remain
     * untouched.
     */

    if (
        fixing.am_usd_oz !== null
    ) {

        await pool.query(
            `
            INSERT INTO lbma_fixings
            (
                date,
                am_usd_oz,
                source,
                source_url,
                retrieved_at
            )
            VALUES
            ($1, $2, $3, $4, NOW())

            ON CONFLICT (date)
            DO UPDATE SET
                am_usd_oz =
                    EXCLUDED.am_usd_oz,
                source =
                    EXCLUDED.source,
                source_url =
                    EXCLUDED.source_url,
                retrieved_at =
                    EXCLUDED.retrieved_at
            `,
            [
                fixing.date,
                fixing.am_usd_oz,
                "Al Abyad",
                SOURCE_URL
            ]
        );
    }

    if (
        fixing.pm_usd_oz !== null
    ) {

        await pool.query(
            `
            UPDATE lbma_fixings
            SET
                pm_usd_oz = $1,
                source = $2,
                source_url = $3,
                retrieved_at = NOW()
            WHERE date = $4
            `,
            [
                fixing.pm_usd_oz,
                "Al Abyad",
                SOURCE_URL,
                fixing.date
            ]
        );
    }

    /*
     * If today's PM is not published,
     * make sure today's Al Abyad record
     * does not contain an old PM value.
     */

    if (
        fixing.pm_usd_oz === null &&
        existing &&
        existing.source === "Al Abyad"
    ) {

        await pool.query(
            `
            UPDATE lbma_fixings
            SET
                pm_usd_oz = NULL,
                retrieved_at = NOW()
            WHERE date = $1
            `,
            [fixing.date]
        );

        console.log(
            "\nToday's PM is not published yet."
        );
    }

    // Read back saved record
    const savedResult =
        await pool.query(
            `
            SELECT
                date,
                am_usd_oz,
                pm_usd_oz,
                source,
                retrieved_at
            FROM lbma_fixings
            WHERE date = $1
            `,
            [fixing.date]
        );

    const saved =
        savedResult.rows[0];

    console.log(
        "\n======================================"
    );

    console.log(
        "POSTGRESQL UPDATED"
    );

    console.log(
        "======================================"
    );

    console.log(
        `Date: ${saved.date}`
    );

    console.log(
        `AM: ${
            saved.am_usd_oz ??
            "Not published"
        }`
    );

    console.log(
        `PM: ${
            saved.pm_usd_oz ??
            "Not published"
        }`
    );

    console.log(
        `Source: ${saved.source}`
    );

    console.log(
        `Retrieved: ${saved.retrieved_at}`
    );
}

async function main() {

    try {

        console.log(
            "======================================"
        );

        console.log(
            "AL ABYAD → POSTGRESQL LIVE UPDATE"
        );

        console.log(
            "======================================"
        );

        const latestFixing =
            await fetchLatestFixing();

        await saveLatestFixing(
            latestFixing
        );

        console.log(
            "\nUPDATE COMPLETED SUCCESSFULLY! ✅"
        );

    } catch (error) {

        console.error(
            "\nUPDATE FAILED ❌"
        );

        console.error(
            error.message
        );

    } finally {

        await pool.end();

        console.log(
            "PostgreSQL connection closed."
        );
    }
}

main();