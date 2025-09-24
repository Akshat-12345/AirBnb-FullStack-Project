const Listing = require('../models/listing.js');
const axios = require("axios")

// module.exports.index = async(req,res)=>{
//     let datas =await Listing.find({});
//     console.log('it is working');
//     res.render('./listings/index.ejs',{ datas })
// };

// listings.js (Updated Code)

module.exports.index = async(req,res)=>{
    // 1. URL se category query parameter nikalein (e.g., ?category=Beach)
    const { category } = req.query;

    // 2. Ek filter object banayein
    const filter = {};
    if (category) {
        filter.category = category;
    }

    // 3. Filter object ko find query mein pass karein
    let datas = await Listing.find(filter);

    // 4. Category ko EJS template mein pass karein (active class ke liye)
    res.render('./listings/index.ejs', { datas, selectedCategory: category || 'Trending' });
};

module.exports.renderNewForm = (req,res)=>{
    console.log(req.user);
    
    res.render('./listings/new.ejs');
};

module.exports.showListing = async(req,res)=>{
    let { id } = req.params;
    let data = await Listing.findById(id).populate({ path : 'reviews', populate: {path : 'author'}}).populate('owner');
    // console.log(data);
    if(!data){
        req.flash('error','Data Not Found!');
        return res.redirect('/listings');
    }
    // res.render('./listings/show.ejs', { data });
    // res.render('./listings/index.ejs',{ datas })


        // --- FORWARD GEOCODING START ---
        const geocodingUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.location)}&format=json&limit=1`;
        
        const response = await axios.get(geocodingUrl);
        let coordinates;

        // Check if Nominatim found a location
        if (response.data && response.data.length > 0) {
            const locationData = response.data[0];
            // Leaflet [latitude, longitude] use karta hai
            coordinates = [parseFloat(locationData.lat), parseFloat(locationData.lon)]; 
        } else {
            // Agar location nahi milti toh fallback coordinates (e.g., India center)
            // Ya fir aap map ko hide bhi kar sakte hain frontend par
            req.flash("error", "Location could not be found on the map.");
            coordinates = null; 
        }
        // --- FORWARD GEOCODING END ---

        res.render("listings/show.ejs", { data, coordinates });

}

module.exports.createListing = async(req,res,next)=>{
        
        if (!req.file) {
        req.flash('error', 'Image upload failed, please select a valid image!');
        return res.redirect('/listings/new');
        }
        // Step 2: If req.file exists, it means the upload to Cloudinary was successful
        let url = req.file.path;
        let filename = req.file.filename;
        console.log("File successfully uploaded to Cloudinary!");
        console.log("Cloudinary URL:", url);
        console.log("Cloudinary Filename:", filename);
        let listing1 = new Listing(req.body.listing);
        listing1.owner = req.user._id;
        listing1.image = {url,filename};
        console.log(listing1);
        await listing1.save();
        req.flash('success','New Listing Created!');
        res.redirect('/listings');
    
}


module.exports.editListings = async(req,res)=>{
    let {id} = req.params;
    console.log(`Editing ID : ${id} ....`);
    let data = await Listing.findById(id);
    if(!data){
        req.flash('error','Data Not Found!');
        return res.redirect('/listings');
    }

    let originalImageUrl = data.image.url;
    originalImageUrl.replace("/upload","/upload/h_200,w_250");
    res.render('./listings/edit.ejs', { data , originalImageUrl});
    
}

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

}

module.exports.deleteListings = async(req,res)=>{
    let {id} = req.params;
    await Listing.findByIdAndDelete(id);
    res.redirect(`/listings`);

}