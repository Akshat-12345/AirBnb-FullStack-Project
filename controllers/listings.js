const Listing = require('../models/listing.js');
const axios = require("axios");

// This function now includes the category filter logic
module.exports.index = async(req,res)=>{
    const { category } = req.query;

    const filter = {};
    if (category) {
        filter.category = category;
    }

    let datas = await Listing.find(filter);

    res.render('./listings/index.ejs', { datas, selectedCategory: category || 'Trending' });
};

module.exports.renderNewForm = (req,res)=>{
    console.log(req.user);
    res.render('./listings/new.ejs');
};

module.exports.showListing = async(req,res)=>{
    let { id } = req.params;
    let data = await Listing.findById(id).populate({ path : 'reviews', populate: {path : 'author'}}).populate('owner');

    if(!data){
        req.flash('error','Data Not Found!');
        return res.redirect('/listings');
    }

    // --- FORWARD GEOCODING WITH USER-AGENT HEADER (THE FIX) ---
    const geocodingUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.location)}&format=json&limit=1`;
    
    let coordinates;
    try {
        const response = await axios.get(geocodingUrl, {
            headers: {
                'User-Agent': 'Wanderlust/1.0 (dev.wanderlust@example.com)' // This header is required by the API
            }
        });

        // Check if Nominatim found a location
        if (response.data && response.data.length > 0) {
            const locationData = response.data[0];
            coordinates = [parseFloat(locationData.lat), parseFloat(locationData.lon)]; 
        } else {
            req.flash("error", "Location could not be found on the map.");
            coordinates = null; 
        }
    } catch (error) {
        console.error("Geocoding API error:", error.message);
        req.flash("error", "Could not fetch map data. Please try again later.");
        coordinates = null;
    }
    // --- FORWARD GEOCODING END ---

    res.render("listings/show.ejs", { data, coordinates });
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