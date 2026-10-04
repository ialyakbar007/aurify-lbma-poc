require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();

const PORT = 5000;

const mongoClient = new MongoClient(process.env.MONGODB_URI);

app.use(cors());
app.use(express.json());

let collection;

// Connect to MongoDB
async function connectDatabase() {
    await mongoClient.connect();

    console.log("Connected to MongoDB Atlas.");

    const database = mongoClient.db("aurify_lbma_poc");

    collection = database.collection("lbma_fixings");

    console.log("Database: aurify_lbma_poc");
    console.log("Collection: lbma_fixings");
}

// Health check
app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "Aurify LBMA POC API is running"
    });
});

// Get latest fixing
app.get("/api/lbma/latest", async (req, res) => {

    try {

        const latest = await collection
            .find({})
            .sort({ date: -1 })
            .limit(1)
            .next();

        if (!latest) {
            return res.status(404).json({
                message: "No fixing data found"
            });
        }

        res.json({
            date: latest.date,
            am_usd_oz: latest.am_usd_oz ?? null,
            pm_usd_oz: latest.pm_usd_oz ?? null,
            source: latest.source,
            retrieved_at: latest.retrieved_at
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve latest fixing"
        });
    }
});

// Get fixing history
app.get("/api/lbma/history", async (req, res) => {

    try {

        const history = await collection
            .find({})
            .sort({ date: -1 })
            .toArray();

        res.json(history);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve fixing history"
        });
    }
});

// Start server
async function startServer() {

    try {

        await connectDatabase();

        app.listen(PORT, () => {

            console.log("");
            console.log("==============================");
            console.log("Aurify LBMA POC API");
            console.log("==============================");
            console.log(`Server running on http://localhost:${PORT}`);
            console.log("");
            console.log("Latest fixing:");
            console.log(`http://localhost:${PORT}/api/lbma/latest`);
            console.log("");
            console.log("Fixing history:");
            console.log(`http://localhost:${PORT}/api/lbma/history`);
        });

    } catch (error) {

        console.error("Failed to start API ❌");
        console.error(error.message);
    }
}

startServer();