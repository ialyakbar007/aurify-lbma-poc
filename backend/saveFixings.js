require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const { MongoClient } = require("mongodb");

const SOURCE_URL = "https://www.8853.it/en/london-fixing.html";

const mongoClient = new MongoClient(process.env.MONGODB_URI);

function cleanNumber(value) {
    if (!value) return null;

    const cleaned = value
        .replace(/,/g, "")
        .trim();

    const number = Number(cleaned);

    return Number.isFinite(number) ? number : null;
}

async function fetchLatestFixing() {

    console.log("Fetching latest fixing from 8853...");

    const response = await axios.get(SOURCE_URL, {
        timeout: 15000,
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    console.log(`8853 response status: ${response.status}`);

    const $ = cheerio.load(response.data);

    const fixings = [];

    $("table tr").each((index, row) => {

        const cells = $(row)
            .find("td")
            .map((i, cell) => $(cell).text().trim())
            .get();

        if (cells.length < 5) {
            return;
        }

        const date = cells[0];

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return;
        }

        fixings.push({
            date: date,
            am_usd_oz: cleanNumber(cells[1]),
            pm_usd_oz: cleanNumber(cells[3])
        });
    });

    if (fixings.length === 0) {
        throw new Error("No fixing data found on 8853.");
    }

    // Sort newest date first
    fixings.sort((a, b) => {
        return b.date.localeCompare(a.date);
    });

    const latest = fixings[0];

    console.log("\nLATEST SOURCE FIXING");
    console.log("====================");
    console.log(`Date: ${latest.date}`);
    console.log(`AM USD/oz: ${latest.am_usd_oz ?? "Not published"}`);
    console.log(`PM USD/oz: ${latest.pm_usd_oz ?? "Not published"}`);

    return latest;
}

async function saveLatestFixing(fixing) {

    await mongoClient.connect();

    console.log("\nConnected to MongoDB Atlas.");

    const database = mongoClient.db("aurify_lbma_poc");

    const collection = database.collection("lbma_fixings");

    await collection.createIndex(
        { date: 1 },
        { unique: true }
    );

    const updateFields = {
        source: "8853",
        source_url: SOURCE_URL,
        retrieved_at: new Date()
    };

    // Only update AM if published
    if (fixing.am_usd_oz !== null) {
        updateFields.am_usd_oz = fixing.am_usd_oz;
    }

    // Only update PM if published
    if (fixing.pm_usd_oz !== null) {
        updateFields.pm_usd_oz = fixing.pm_usd_oz;
    }

    await collection.updateOne(
        { date: fixing.date },
        {
            $set: updateFields,
            $setOnInsert: {
                date: fixing.date
            }
        },
        {
            upsert: true
        }
    );

    console.log("\nMONGODB UPDATED");
    console.log("================");
    console.log(`Date: ${fixing.date}`);

    const saved = await collection.findOne({
        date: fixing.date
    });

    console.log(
        `AM: ${saved.am_usd_oz ?? "Not published"}`
    );

    console.log(
        `PM: ${saved.pm_usd_oz ?? "Not published"}`
    );
}

async function main() {

    try {

        console.log("==============================");
        console.log("8853 → MongoDB LIVE UPDATE");
        console.log("==============================");

        const latestFixing = await fetchLatestFixing();

        await saveLatestFixing(latestFixing);

        console.log("\nUPDATE COMPLETED SUCCESSFULLY! ✅");

    } catch (error) {

        console.error("\nUPDATE FAILED ❌");
        console.error(error.message);

    } finally {

        await mongoClient.close();

        console.log("MongoDB connection closed.");
    }
}

main();