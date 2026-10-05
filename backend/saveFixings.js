require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const { MongoClient } = require("mongodb");

const SOURCE_URL =
    "https://www.alabyadjewellers.com/bullion/en/live-rate";

const mongoClient = new MongoClient(
    process.env.MONGODB_URI
);


/*
=========================================================
HELPER: EXTRACT PRICE FROM AL ABYAD CELL
=========================================================

Example input:

4163.45 05-10-2026 01:30 PM

Returns:

4163.45
=========================================================
*/

function extractPrice(value) {

    if (!value) {
        return null;
    }

    const match = value.match(
        /^\s*([\d,]+(?:\.\d+)?)/
    );

    if (!match) {
        return null;
    }

    const number = Number(
        match[1].replace(/,/g, "")
    );

    return Number.isFinite(number)
        ? number
        : null;
}


/*
=========================================================
HELPER: EXTRACT DATE FROM AL ABYAD CELL
=========================================================

Example:

4163.45 05-10-2026 01:30 PM

Returns:

2026-10-05
=========================================================
*/

function extractDate(value) {

    if (!value) {
        return null;
    }

    const match = value.match(
        /(\d{2})-(\d{2})-(\d{4})/
    );

    if (!match) {
        return null;
    }

    const day = match[1];
    const month = match[2];
    const year = match[3];

    return `${year}-${month}-${day}`;
}


/*
=========================================================
HELPER: GET TODAY'S DATE IN LONDON
=========================================================

The fixing date belongs to London.

Example:

2026-10-05
=========================================================
*/

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


/*
=========================================================
FETCH AL ABYAD LBMA FIXING
=========================================================
*/

async function fetchLatestFixing() {

    console.log(
        "Fetching latest fixing from Al Abyad..."
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


    const $ = cheerio.load(
        response.data
    );


    /*
    =====================================================
    TODAY'S LONDON FIXING DATE
    =====================================================
    */

    const todayLondon =
        getLondonDate();


    console.log(
        `Today's London fixing date: ${todayLondon}`
    );


    let amFix = null;

    let pmFix = null;


    /*
    =====================================================
    FIND THE LBMA LONDON TABLE
    =====================================================
    */

    $("table").each(
        (tableIndex, table) => {

            /*
            Stop if both today's values
            have already been found.
            */

            if (
                amFix !== null &&
                pmFix !== null
            ) {
                return;
            }


            const tableText =
                $(table)
                    .text()
                    .replace(/\s+/g, " ")
                    .trim();


            /*
            We only want:

            TODAY'S RATE - LBMA LONDON

            containing:

            GOLD AM Fix
            GOLD PM Fix
            */

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
                "\nFound Al Abyad LBMA fixing table."
            );


            /*
            =================================================
            FIND DATA ROWS
            =================================================

            Expected row:

            [
                "4163.45 05-10-2026 01:30 PM",
                "4190.05 02-10-2026 06:00 PM",
                "61.0350 02-10-2026 03:00 PM"
            ]

            IMPORTANT:

            Cell 0 = GOLD AM Fix
            Cell 1 = GOLD PM Fix
            Cell 2 = SILVER Fix
            =================================================
            */

            $(table)
                .find("tr")
                .each(
                    (rowIndex, row) => {

                        const cells =
                            $(row)
                                .find("td")
                                .map(
                                    (
                                        i,
                                        cell
                                    ) =>
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


                        /*
                        Make sure this is actually
                        an AM/PM gold fixing row.
                        */

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


                        /*
                        Ignore rows that don't contain
                        valid fixing information.
                        */

                        if (
                            amPrice === null &&
                            pmPrice === null
                        ) {
                            return;
                        }


                        console.log(
                            "\nAl Abyad fixing row:"
                        );

                        console.log(
                            cells
                        );


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


                        /*
                        =================================================
                        AM LOGIC
                        =================================================

                        Only accept AM if:

                        AM date === today's London date
                        */

                        if (
                            amPrice !== null &&
                            amDate === todayLondon
                        ) {

                            amFix = {

                                price:
                                    amPrice,

                                date:
                                    amDate
                            };

                        }


                        /*
                        =================================================
                        PM LOGIC
                        =================================================

                        Only accept PM if:

                        PM date === today's London date

                        If Al Abyad is showing yesterday's PM,
                        it will NOT be saved as today's PM.
                        */

                        if (
                            pmPrice !== null &&
                            pmDate === todayLondon
                        ) {

                            pmFix = {

                                price:
                                    pmPrice,

                                date:
                                    pmDate
                            };

                        }


                    }
                );
        }
    );


    /*
    =====================================================
    PRINT WHAT WAS FOUND
    =====================================================
    */

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

        console.log(
            `AM FIX DATE: ${amFix.date}`
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

        console.log(
            `PM FIX DATE: ${pmFix.date}`
        );

    } else {

        console.log(
            "PM FIX: Not available for today"
        );

    }


    /*
    =====================================================
    RETURN TODAY'S FIXING
    =====================================================
    */

    return {

        date:
            todayLondon,

        am_usd_oz:
            amFix
                ? amFix.price
                : null,

        pm_usd_oz:
            pmFix
                ? pmFix.price
                : null,

        am_date:
            amFix
                ? amFix.date
                : null,

        pm_date:
            pmFix
                ? pmFix.date
                : null
    };
}


/*
=========================================================
SAVE TODAY'S FIXING TO MONGODB
=========================================================
*/

async function saveLatestFixing(
    fixing
) {

    await mongoClient.connect();


    console.log(
        "\nConnected to MongoDB Atlas."
    );


    const database =
        mongoClient.db(
            "aurify_lbma_poc"
        );


    const collection =
        database.collection(
            "lbma_fixings"
        );


    /*
    =====================================================
    ENSURE DATE IS UNIQUE
    =====================================================
    */

    await collection.createIndex(
        {
            date: 1
        },
        {
            unique: true
        }
    );


    /*
    =====================================================
    FIND TODAY'S EXISTING DOCUMENT
    =====================================================
    */

    const existing =
        await collection.findOne(
            {
                date:
                    fixing.date
            }
        );


    console.log(
        "\nExisting today's document:"
    );


    if (existing) {

        console.log(
            `Date: ${existing.date}`
        );

        console.log(
            `AM: ${
                existing.am_usd_oz ??
                "null"
            }`
        );

        console.log(
            `PM: ${
                existing.pm_usd_oz ??
                "null"
            }`
        );

        console.log(
            `Source: ${
                existing.source ??
                "unknown"
            }`
        );

    } else {

        console.log(
            "No document exists for today."
        );

    }


    /*
    =====================================================
    BUILD UPDATE
    =====================================================
    */

    const updateFields = {

        source:
            "Al Abyad",

        source_url:
            SOURCE_URL,

        retrieved_at:
            new Date()
    };


    /*
    =====================================================
    AM
    =====================================================

    If today's AM is available:

        save AM

    Otherwise:

        don't change existing AM.
    */

    if (
        fixing.am_usd_oz !== null
    ) {

        updateFields.am_usd_oz =
            fixing.am_usd_oz;

    }


    /*
    =====================================================
    PM
    =====================================================

    If today's PM is available:

        save PM

    If today's PM is NOT available:

        IMPORTANT:

        Remove an incorrectly stored Al Abyad PM
        from today's document.

        This fixes the previous test where
        02-10-2026 PM was incorrectly assigned
        to 05-10-2026.
    */

    if (
        fixing.pm_usd_oz !== null
    ) {

        updateFields.pm_usd_oz =
            fixing.pm_usd_oz;

    }


    /*
    =====================================================
    BUILD MONGODB UPDATE
    =====================================================
    */

    const updateOperation = {

        $set:
            updateFields,

        $setOnInsert:
        {
            date:
                fixing.date
        }

    };


    /*
    =====================================================
    REMOVE INCORRECT PM

    Only do this when:

    1. Today's PM is NOT available
    2. Today's existing record came from Al Abyad

    This protects your old 8853 historical records.
    =====================================================
    */

    if (
        fixing.pm_usd_oz === null &&
        existing &&
        existing.source === "Al Abyad"
    ) {

        updateOperation.$unset = {

            pm_usd_oz: ""

        };


        console.log(
            "\nToday's PM is not published yet."
        );

        console.log(
            "Removing previously stored Al Abyad PM value."
        );

    }


    /*
    =====================================================
    UPSERT
    =====================================================
    */

    await collection.updateOne(

        {
            date:
                fixing.date
        },

        updateOperation,

        {
            upsert:
                true
        }
    );


    /*
    =====================================================
    READ FINAL DOCUMENT
    =====================================================
    */

    const saved =
        await collection.findOne(
            {
                date:
                    fixing.date
            }
        );


    console.log(
        "\n======================================"
    );

    console.log(
        "MONGODB UPDATED"
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
        `Source: ${
            saved.source
        }`
    );

    console.log(
        `Retrieved: ${
            saved.retrieved_at
        }`
    );
}


/*
=========================================================
MAIN
=========================================================
*/

async function main() {

    try {

        console.log(
            "======================================"
        );

        console.log(
            "AL ABYAD → MONGODB LIVE UPDATE"
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

    }
    catch (error) {

        console.error(
            "\nUPDATE FAILED ❌"
        );

        console.error(
            error.message
        );

    }
    finally {

        await mongoClient.close();

        console.log(
            "MongoDB connection closed."
        );
    }
}


main();