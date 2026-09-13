const Listing = require('../models/listing.js');
const axios = require("axios");
const Booking = require("../models/booking"); 

// 1. INDEX ROUTE (Multi-Filtering Navbar Search, Sidebar, and HTML/JSON Hybrid Support)
module.exports.index = async(req, res) => {
    try {
        const { category, search, maxPrice, imageTag, json } = req.query;
        const filter = {};

        // A. Category Filter
        if (category && category !== "") {
            filter.category = category;
        }

        // B. Navbar Text Search
        if (search && search.trim() !== "") {
            const cleanSearch = search.trim();
            filter.$or = [
                { title: { $regex: cleanSearch, $options: "i" } },
                { location: { $regex: cleanSearch, $options: "i" } },
                { country: { $regex: cleanSearch, $options: "i" } }
            ];
        }

        // C. Sidebar Price Filter
        if (maxPrice) {
            filter.price = { $lte: Number(maxPrice) };
        }

        // D. Sidebar Nested Image Tag Filter
        if (imageTag) {
            const tagsArray = Array.isArray(imageTag) ? imageTag : [imageTag];
            filter.images = {
                $elemMatch: { tag: { $in: tagsArray } }
            };
        }

        let datas = await Listing.find(filter).populate("reviews");

        // Autocomplete API JSON support
        if (json === "true") {
            return res.status(200).json({ success: true, listings: datas });
        }

        res.render('./listings/index.ejs', { 
            datas, 
            selectedCategory: category || 'Trending',
            currentFilters: { 
                search: search || '', 
                maxPrice: maxPrice || '100000', 
                category: category || '',
                imageTag: imageTag ? (Array.isArray(imageTag) ? imageTag : [imageTag]) : []
            }
        });

    } catch (err) {
        console.error("Advanced Search Pipeline Error:", err);
        if (req.query.json === "true") {
            return res.status(500).json({ success: false, message: "Server search endpoint failed" });
        }
        req.flash("error", "Failed to process listing filters!");
        res.redirect("/listings");
    }
};

// 2. RENDER NEW FORM
module.exports.renderNewForm = (req, res) => {
    console.log(req.user);
    res.render('./listings/new.ejs');
};

// 3. SHOW LISTING (Integrated with Dynamic Host Stats & Intelligent Similar Stays Suggestion)
module.exports.showListing = async(req, res) => {
    let { id } = req.params;
    
    let data = await Listing.findById(id)
        .populate({ path: 'reviews', populate: { path: 'author' } })
        .populate('owner');

    if (!data) {
        req.flash('error', 'Data Not Found!');
        return res.redirect('/listings');
    }

    // === 🔍 INTELLIGENT SIMILAR / NEARBY LISTINGS PIPELINE ===
    let similarListings = [];
    try {
        // Step 1: Match by exact Category (excluding current listing)
        let primaryQuery = { _id: { $ne: id } };
        if (data.category) {
            primaryQuery.category = data.category;
        }

        similarListings = await Listing.find(primaryQuery)
            .populate("reviews")
            .limit(10);

        // Step 2: Fallback if less than 4 matching category stays found
        if (similarListings.length < 4) {
            const fallbackListings = await Listing.find({
                _id: { $ne: id, $nin: similarListings.map(l => l._id) }
            })
            .populate("reviews")
            .limit(10 - similarListings.length);

            similarListings = [...similarListings, ...fallbackListings];
        }
    } catch (similarErr) {
        console.error("Error fetching similar listings:", similarErr.message);
        similarListings = [];
    }

    // === 🌟 DYNAMIC HOST REVIEWS & AVERAGE RATING AGGREGATION ===
    let hostTotalReviews = 0;
    let hostRatingSum = 0;
    let hostAverageRating = "New";

    if (data.owner) {
        try {
            const allHostListings = await Listing.find({ owner: data.owner._id }).populate("reviews");
            
            allHostListings.forEach(l => {
                if (l.reviews && l.reviews.length > 0) {
                    l.reviews.forEach(r => {
                        if (r.rating) {
                            hostRatingSum += Number(r.rating);
                            hostTotalReviews += 1;
                        }
                    });
                }
            });

            if (hostTotalReviews > 0) {
                hostAverageRating = (hostRatingSum / hostTotalReviews).toFixed(2);
            }
        } catch (hostStatsErr) {
            console.error("Error calculating host stats:", hostStatsErr.message);
        }
    }

    // --- FORWARD GEOCODING WITH USER-AGENT HEADER ---
    const geocodingUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.location)}&format=json&limit=1`;
    let coordinates;
    try {
        const response = await axios.get(geocodingUrl, {
            headers: {
                'User-Agent': 'AkshatTest/1.0',
                'Accept': 'application/json'
            },
            timeout: 5000 
        });

        if (response.data && response.data.length > 0) {
            const locationData = response.data[0];
            coordinates = [parseFloat(locationData.lat), parseFloat(locationData.lon)]; 
        } else {
            coordinates = null; 
        }
    } catch (error) {
        console.error("Geocoding API error:", error.message);
        coordinates = null;
    }

    // === ADVANCED 5-DAY WEATHER FORECAST PIPELINE ===
    let forecastArray = null;
    try {
        const apiKey = process.env.WEATHER_API_KEY;
        if (apiKey) {
            const cleanCity = data.location.split(',')[0].trim();
            const forecastResponse = await axios.get(
                `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(cleanCity)}&units=metric&appid=${apiKey}`
            );
            
            if (forecastResponse.data && forecastResponse.data.list) {
                forecastArray = [];
                for (let i = 0; i < forecastResponse.data.list.length; i += 8) {
                    const dayData = forecastResponse.data.list[i];
                    const dateObj = new Date(dayData.dt_txt);
                    
                    forecastArray.push({
                        dayName: dateObj.toLocaleDateString("en-US", { weekday: 'short' }),
                        dateStr: dateObj.toLocaleDateString("en-US", { month: 'short', day: 'numeric' }),
                        temp: Math.round(dayData.main.temp),
                        humidity: dayData.main.humidity,
                        description: dayData.weather[0].description,
                        icon: dayData.weather[0].icon
                    });
                }
            }
        }
    } catch (weatherErr) {
        console.error("Weather forecast pipeline bypassed:", weatherErr.message);
    }

    // === 📸 GUEST APPROVED GALLERY PIPELINE ===
    let approvedMedia = [];
    try {
        const verifiedBookings = await Booking.find({
            listing: id,
            isApprovedByOwner: true
        }).select("checkInMedia");

        approvedMedia = verifiedBookings.map(b => b.checkInMedia).filter(Boolean);
    } catch (mediaErr) {
        console.error("Error fetching approved guest media:", mediaErr.message);
    }

    // Render template with similarListings & calculated host metadata
    res.render("listings/show.ejs", { 
        data, 
        similarListings,
        coordinates, 
        weatherForecast: forecastArray, 
        approvedMedia, 
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        hostTotalReviews,
        hostAverageRating
    });
};

// 4. CREATE LISTING (MULTIPLE IMAGES WITH TAGS)
module.exports.createListing = async(req, res, next) => {
    if (!req.files || req.files.length === 0) {
        req.flash('error', 'Image upload failed, please select a valid image!');
        return res.redirect('/listings/new');
    }

    let listing1 = new Listing(req.body.listing);
    listing1.owner = req.user._id;
    
    const tags = req.body.imageTags || [];

    listing1.images = req.files.map((file, index) => {
        return {
            url: file.path,
            filename: file.filename,
            tag: Array.isArray(tags) ? (tags[index] || 'General') : (tags || 'General')
        };
    });

    console.log("Files with tags successfully uploaded to Cloudinary!");
    
    await listing1.save();
    req.flash('success', 'New Listing Created!');
    res.redirect('/listings');
};

// 5. EDIT LISTINGS
module.exports.editListings = async(req, res) => {
    let { id } = req.params;
    console.log(`Editing ID : ${id} ....`);
    let data = await Listing.findById(id);
    if (!data) {
        req.flash('error', 'Data Not Found!');
        return res.redirect('/listings');
    }

    let originalImageUrl = "";
    if (data.images && data.images.length > 0) {
        originalImageUrl = data.images[0].url;
    } else {
        originalImageUrl = "https://images.unsplash.com/photo-1584132967334-10e028bd69f7";
    }
    
    let modifiedImageUrl = originalImageUrl.replace("/upload", "/upload/h_200,w_250");
    res.render('./listings/edit.ejs', { data, originalImageUrl: modifiedImageUrl });
};

// 6. UPDATE LISTINGS
module.exports.updateListings = async(req, res) => {
    let { id } = req.params;
    
    let newListings = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    if (typeof req.files !== "undefined" && req.files.length > 0) {
        const tags = req.body.imageTags || [];
        
        let newImages = req.files.map((file, index) => ({
            url: file.path,
            filename: file.filename,
            tag: Array.isArray(tags) ? (tags[index] || 'General') : (tags || 'General')
        }));
        
        newListings.images = newImages;
        await newListings.save();
    } 
    req.flash('success', 'Listing Updated Successfully!');
    res.redirect(`/listings/${id}`);
};

// 7. DELETE LISTINGS
module.exports.deleteListings = async(req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash('success', 'Listing Deleted!'); 
    res.redirect(`/listings`);
};