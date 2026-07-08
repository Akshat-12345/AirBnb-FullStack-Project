const Listing = require('../models/listing.js');
const axios = require("axios");
const Booking = require("../models/booking"); 

// 1. INDEX ROUTE (Upgraded for Multi-Filtering Navbar Search, Sidebar, and HTML/JSON Hybrid Support)
module.exports.index = async(req, res) => {
    try {
        const { category, search, maxPrice, imageTag, json } = req.query;
        const filter = {};

        // A. Category Filter (Tabs aur Sidebar dono ke liye)
        if (category && category !== "") {
            filter.category = category;
        }

        // B. Navbar Text Search (Case-insensitive matching for Title, Location, Country)
        if (search && search.trim() !== "") {
            const cleanSearch = search.trim();
            filter.$or = [
                { title: { $regex: cleanSearch, $options: "i" } },
                { location: { $regex: cleanSearch, $options: "i" } },
                { country: { $regex: cleanSearch, $options: "i" } }
            ];
        }

        // C. Sidebar Price Filter (Max Range Constraint)
        if (maxPrice) {
            filter.price = { $lte: Number(maxPrice) };
        }

        // D. Sidebar Nested Image Tag Filter (MongoDB $elemMatch pipeline)
        if (imageTag) {
            const tagsArray = Array.isArray(imageTag) ? imageTag : [imageTag];
            filter.images = {
                $elemMatch: { tag: { $in: tagsArray } }
            };
        }

        // Database search execute karte hain aur reviews populate rakhte hain
        let datas = await Listing.find(filter).populate("reviews");

        // ⚡ CRITICAL AUTOCOMPLETE FIX: Agar frontend live search se JSON format maange
        if (json === "true") {
            return res.status(200).json({ success: true, listings: datas });
        }

        // Standard EJS HTML Render format (Jab user enter maarega ya page direct load karega)
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

// 2. RENDER NEW FORM (No change)
module.exports.renderNewForm = (req,res)=>{
    console.log(req.user);
    res.render('./listings/new.ejs');
};

// 3. SHOW LISTING (No change)
module.exports.showListing = async(req,res)=>{
    let { id } = req.params;
    
    let data = await Listing.findById(id).populate({ path : 'reviews', populate: {path : 'author'}}).populate('owner');

    if(!data){
        req.flash('error','Data Not Found!');
        return res.redirect('/listings');
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

    // === 📸 NEW GUEST APPROVED GALLERY PIPELINE ===
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

    res.render("listings/show.ejs", { 
        data, 
        coordinates, 
        weatherForecast: forecastArray, 
        approvedMedia, 
        razorpayKeyId: process.env.RAZORPAY_KEY_ID 
    });
};

// 4. CREATE LISTING (UPDATED FOR MULTIPLE IMAGES WITH TAGS)
module.exports.createListing = async(req,res,next)=>{
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
    req.flash('success','New Listing Created!');
    res.redirect('/listings');
};

// 5. EDIT LISTINGS (UPDATED FOR ARRAY PREVIEW - No change)
module.exports.editListings = async(req,res)=>{
    let {id} = req.params;
    console.log(`Editing ID : ${id} ....`);
    let data = await Listing.findById(id);
    if(!data){
        req.flash('error','Data Not Found!');
        return res.redirect('/listings');
    }

    let originalImageUrl = "";
    if(data.images && data.images.length > 0) {
        originalImageUrl = data.images[0].url;
    } else {
        originalImageUrl = "https://images.unsplash.com/photo-1584132967334-10e028bd69f7";
    }
    
    let modifiedImageUrl = originalImageUrl.replace("/upload","/upload/h_200,w_250");
    res.render('./listings/edit.ejs', { data , originalImageUrl: modifiedImageUrl });
};

// 6. UPDATE LISTINGS (UPDATED FOR MULTIPLE IMAGES REPLACEMENT/APPEND WITH TAGS)
module.exports.updateListings = async(req,res)=>{
    let {id} = req.params;
    
    let newListings = await Listing.findByIdAndUpdate(id,{...req.body.listing});

    if(typeof req.files !== "undefined" && req.files.length > 0){
        const tags = req.body.imageTags || [];
        
        let newImages = req.files.map((file, index) => ({
            url: file.path,
            filename: file.filename,
            tag: Array.isArray(tags) ? (tags[index] || 'General') : (tags || 'General')
        }));
        
        newListings.images = newImages;
        await newListings.save();
    } 
    req.flash('success','Listing Updated Successfully!');
    res.redirect(`/listings/${id}`);
};

// 7. DELETE LISTINGS (No change)
module.exports.deleteListings = async(req,res)=>{
    let {id} = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash('success', 'Listing Deleted!'); 
    res.redirect(`/listings`);
};