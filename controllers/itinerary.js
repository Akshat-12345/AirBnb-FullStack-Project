// controllers/itinerary.js

const Listing = require("../models/listing"); 
const Itinerary = require("../models/itinerary"); 
const { GoogleGenAI } = require("@google/genai"); 

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

module.exports.generateItinerary = async (req, res) => {
    try {
        const { listingId } = req.params;
        const userId = req.user._id; 

        const totalDays = parseInt(req.query.days) || 3; 
        const isRegenerate = req.query.regenerate === "true"; 

        if (!isRegenerate) {
            let existingItinerary = await Itinerary.findOne({ listingId, userId });
            if (existingItinerary) {
                console.log(`Database se saved (${existingItinerary.totalDays} Days) plan fetch kiya.`);
                return res.json({ status: "success", data: existingItinerary });
            }
        }

        const currentListing = await Listing.findById(listingId);
        if (!currentListing) {
            return res.status(404).json({ status: "error", error: "Listing not found!" });
        }
        const destination = currentListing.location; 

        console.log(`AI Timetable generate ho raha hai: ${destination} (${totalDays} Days) ke liye...`);

        const systemPrompt = `You are an expert travel planner. Generate a highly structured ${totalDays}-day hourly timetable itinerary for ${destination}. 
        The response must contain exactly ${totalDays} days in the root array structure.
        The response must strictly follow a fixed time-slot format. Do not use generic descriptions; provide specific location names, local restaurants, and activities.
        Ensure buffer times between places. Keep mid-trip slightly relaxed to prevent travel fatigue.
        You must return the response strictly in the requested JSON structure. No conversational filler, no markdown formatting like \\\`\\\`\\\`json outside the schema.`;

        // 🌟 FIX: Model name updated to 'gemini-2.5-flash' for the new Google GenAI SDK stability
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: systemPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        days: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    dayNumber: { type: 'INTEGER' },
                                    theme: { type: 'STRING' },
                                    schedule: {
                                        type: 'ARRAY',
                                        items: {
                                            type: 'OBJECT',
                                            properties: {
                                                timeSlot: { type: 'STRING' },
                                                activity: { type: 'STRING' },
                                                category: { type: 'STRING' }, 
                                                notes: { type: 'STRING' }
                                            },
                                            required: ['timeSlot', 'activity', 'category', 'notes']
                                        }
                                    }
                                },
                                required: ['dayNumber', 'theme', 'schedule']
                            }
                        }
                    },
                    required: ['days']
                },
                temperature: 0.2, 
            }
        });

        const cleanJSONData = JSON.parse(response.text);

        const finalItinerary = await Itinerary.findOneAndUpdate(
            { userId, listingId },
            { 
                destination, 
                totalDays, 
                scheduleData: cleanJSONData.days 
            },
            { new: true, upsert: true } 
        );

        console.log(`AI Timetable (${totalDays} Days) MongoDB mein upsert ho gaya.`);
        res.json({ status: "success", data: finalItinerary });

    } catch (err) {
        console.error("AI Generation Error:", err);
        res.status(500).json({ status: "error", error: "AI pipeline structure processing failed." });
    }
};