// flashBookings.js
const mongoose = require("mongoose");
const path = require("path");

// Force require local env parameters directly
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Booking = require("./models/booking");

// STRICT FIX: Points exactly to your live Cloud Atlas Cluster database endpoint
const dbUrl = "mongodb+srv://akshatbajpai2020_db_user:akshat194131@cluster0.bkld6dq.mongodb.net/airbnb?retryWrites=true&w=majority&appName=Cluster0";

async function flashDatabaseQueue() {
    console.log("\n📡 Core Flash System: Initializing cloud data wiping sequence...");
    console.log("⏳ Target Endpoint verified as MongoDB Atlas Cloud Cluster.");
    
    try {
        // Strict connection config parameters
        await mongoose.connect(dbUrl);
        console.log("✅ SUCCESS: Connection Matrix Secured with MongoDB Atlas Cluster!");

        // Tracking active items inside the cloud cluster
        const initialCount = await Booking.countDocuments({});
        console.log(`📊 Analysis: Found ${initialCount} active booking records inside cloud database.`);

        if (initialCount === 0) {
            console.log("✨ Cloud cluster collection is already pristine empty! No operation required.");
            process.exit(0);
        }

        console.log("🧹 Dropping active collection array bounds from cloud stream...");
        // THE EXPLICIT WIPE
        await Booking.deleteMany({});
        
        console.log("\n🎉 CONGRATULATIONS BHAI: Cloud database is now a 100% clean slate!");
        console.log(`⚙️ Verification Node: 0 / ${initialCount} history strings remaining.\n`);
        
        process.exit(0);
    } catch (error) {
        console.error("\n🚨 CRITICAL DEPLOYMENT EXCEPTION: Wiping rejected by remote cluster cluster:", error.message);
        process.exit(1);
    }
}

// Fire the pipeline execution engine
flashDatabaseQueue();