const Listing = require('../models/listing.js');
const axios = require("axios");

// This function now includes the category filter logic
module.exports.index = async(req,res)=>{
    const { category } = req.query;

    const filter = {};
    if (category) {
        filter.category = category;
    }

    let datas = await Listing.find(filter).populate("reviews");

    res.render('./listings/index.ejs', { datas, selectedCategory: category || 'Trending' });
};

module.exports.renderNewForm = (req,res)=>{
    console.log(req.user);
    res.render('./listings/new.ejs');
};

// Inside controllers/listing.js
const Booking = require("../models/booking"); // Ensure top par ya function ke andar required ho

module.exports.showListing = async(req,res)=>{
    let { id } = req.params;
    
    // 1. Core Listing Data Fetch (Populating Reviews & Owner)
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

    // === 📸 NEW GUEST APPROVED GALLERY PIPELINE (THE FIX) ===
    let approvedMedia = [];
    try {
        // Un bookings ko nikalna jiska media owner ne dashboard se approve kiya hai
        const verifiedBookings = await Booking.find({
            listing: id,
            isApprovedByOwner: true
        }).select("checkInMedia");

        // Media objects ko extract karke flatten karna
        approvedMedia = verifiedBookings.map(b => b.checkInMedia).filter(Boolean);
    } catch (mediaErr) {
        console.error("Error fetching approved guest media:", mediaErr.message);
    }

    // === ALL DATA STREAM INJECTED INTO RENDERING ENGINE ===
    res.render("listings/show.ejs", { 
        data, 
        coordinates, 
        weatherForecast: forecastArray, 
        approvedMedia, // Ab show.ejs ko pic/video array mil jayega!
        razorpayKeyId: process.env.RAZORPAY_KEY_ID 
    });
};

module.exports.createListing = async(req,res,next)=>{
    if (!req.file) {
        req.flash('error', 'Image upload failed, please select a valid image!');
        return res.redirect('/listings/new');
    }
    let url = req.file.path;
    let filename = req.file.filename;
    console.log("File successfully uploaded to Cloudinary!");
    console.log("Cloudinary URL:", url);
    console.log("Cloudinary Filename:", filename);

    let listing1 = new Listing(req.body.listing);
    listing1.owner = req.user._id;
    listing1.image = {url,filename};
    
    await listing1.save();
    req.flash('success','New Listing Created!');
    res.redirect('/listings');
};

module.exports.editListings = async(req,res)=>{
    let {id} = req.params;
    console.log(`Editing ID : ${id} ....`);
    let data = await Listing.findById(id);
    if(!data){
        req.flash('error','Data Not Found!');
        return res.redirect('/listings');
    }

    let originalImageUrl = data.image.url;
    // Note: Cloudinary transformations should be applied carefully. 
    // This string replace is one way, but URL generation APIs are safer.
    let modifiedImageUrl = originalImageUrl.replace("/upload","/upload/h_200,w_250");
    res.render('./listings/edit.ejs', { data , originalImageUrl: modifiedImageUrl });
};

module.exports.updateListings = async(req,res)=>{
    let {id} = req.params;
    let newListings = await Listing.findByIdAndUpdate(id,{...req.body.listing});

    if(typeof req.file !== "undefined"){
        let url = req.file.path;
        let filename = req.file.filename;
        console.log("File successfully uploaded to Cloudinary!");
        console.log("Cloudinary URL:", url);
        console.log("Cloudinary Filename:", filename);
        newListings.image = {url,filename};
        await newListings.save();
    } 
    req.flash('success','Listing Updated Successfully!');
    res.redirect(`/listings/${id}`);
};

module.exports.deleteListings = async(req,res)=>{
    let {id} = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash('success', 'Listing Deleted!'); // It's good practice to flash a message on deletion too
    res.redirect(`/listings`);
};