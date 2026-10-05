require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function connectDatabase() {
    try {
        const result = await pool.query("SELECT NOW()");

        console.log("Connected to PostgreSQL.");
        console.log("Database time:", result.rows[0].now);
    } catch (error) {
        console.error("PostgreSQL connection failed ❌");
        console.error(error.message);

        process.exit(1);
    }
}


// ==========================================
// ROOT
// ==========================================

app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "Aurify LBMA POC API is running",
        database: "PostgreSQL"
    });
});


// ==========================================
// LATEST FIXING
// ==========================================

app.get("/api/lbma/latest", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                date,
                am_usd_oz,
                pm_usd_oz,
                source,
                retrieved_at
            FROM lbma_fixings
            ORDER BY date DESC
            LIMIT 1
        `);

        if (result.rows.length === 0) {

            return res.status(404).json({
                message: "No fixing data found"
            });

        }

        const latest = result.rows[0];

        res.json({
            date: latest.date,
            am_usd_oz: latest.am_usd_oz ?? null,
            pm_usd_oz: latest.pm_usd_oz ?? null,
            source: latest.source,
            retrieved_at: latest.retrieved_at
        });

    } catch (error) {

        console.error("Latest fixing error:", error);

        res.status(500).json({
            message: "Failed to retrieve latest fixing"
        });

    }

});


// ==========================================
// FIXING HISTORY
// ==========================================

app.get("/api/lbma/history", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                date,
                am_usd_oz,
                pm_usd_oz,
                source,
                source_url,
                retrieved_at
            FROM lbma_fixings
            ORDER BY date DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error("History error:", error);

        res.status(500).json({
            message: "Failed to retrieve fixing history"
        });

    }

});


// ==========================================
// START SERVER
// ==========================================

async function startServer() {

    try {

        // ------------------------------------------
        // Connect to PostgreSQL first
        // ------------------------------------------

        await connectDatabase();


        // ------------------------------------------
        // Start API
        // ------------------------------------------

        app.listen(PORT, () => {

            console.log("");
            console.log("==============================");
            console.log("Aurify LBMA POC API");
            console.log("==============================");

            console.log(
                `Server running on http://localhost:${PORT}`
            );

            console.log("");
            console.log(
                `Latest fixing: http://localhost:${PORT}/api/lbma/latest`
            );

            console.log("");
            console.log(
                `Fixing history: http://localhost:${PORT}/api/lbma/history`
            );

            console.log("");
            console.log("Database: PostgreSQL");
            console.log("Table: lbma_fixings");

        });


        // ------------------------------------------
        // Start LBMA scheduler
        // ------------------------------------------

        console.log("");
        console.log("==============================");
        console.log("Starting LBMA Scheduler");
        console.log("==============================");

        require("./scheduler");

    } catch (error) {

        console.error("Failed to start API ❌");
        console.error(error.message);

    }

}

startServer();