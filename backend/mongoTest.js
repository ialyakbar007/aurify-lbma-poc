const { MongoClient } = require("mongodb");
require("dotenv").config();

const client = new MongoClient(process.env.MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 10000
});

async function testMongo() {
    try {
        console.log("Connecting to MongoDB Atlas...");

        await client.connect();

        console.log("MongoDB connection successful!");

        const db = client.db("aurify_lbma_poc");

        console.log("Database selected:", db.databaseName);

        const collections = await db.listCollections().toArray();

        console.log(
            "Existing collections:",
            collections.map(c => c.name)
        );

    } catch (error) {
        console.error("MongoDB connection failed");
        console.error(error);

    } finally {
        await client.close();
        console.log("MongoDB connection closed.");
    }
}

testMongo();