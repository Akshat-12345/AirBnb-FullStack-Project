const { ref } = require('joi');
const mongoose = require('mongoose');
const Review = require('./review.js');
// "/c/Program Files/MongoDB/Server/8.0/bin/mongod.exe" --dbpath="/c/data/db"
const listingSchema = new mongoose.Schema({
    title : {
        type : String,
        required :true,  
    },

    description : String,

    // image : {
    //     filename: String,
    //     url: {
    //       type: String,
    //       set: (v) =>v === ""? "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D": v,
    // },
    // },
    image : {
            url : String,
            filename : String,
    },
    price : Number,
    location : String,
    country :String,
    reviews : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Review',
        }
    ],
    owner : {
        type :mongoose.Schema.Types.ObjectId,
        ref : 'User',
    },
    category: {
        type: String,
        enum: ['Trending', 'Rooms', 'Amazing views', 'Mansions', 'Amazing pools', 'Beach', 'Cabins', 'Camping', 'Farms'],
        default: 'Trending' // Aap ek default value de sakte hain
    },
});

listingSchema.post("findOneAndDelete",async(lising)=>{
    if(lising){
        await Review.deleteMany({_id : {$in : lising.reviews} })
    }
})

const Listing = mongoose.model("Listing",listingSchema);
module.exports = Listing;