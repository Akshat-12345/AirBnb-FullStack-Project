const mongoose = require('mongoose');
const initData = require('./data.js');
const Listing = require('../models/listing.js');


main()
   .then(()=>{
    console.log("Connected To Database");
   })
   .catch((err)=>{
    console.error(`Some Error Occured: ${err}`);
   })


async function main() {
    mongoose.connect('mongodb://127.0.0.1:27017/airbnb');
};

const initDB = async () =>{
    await Listing.deleteMany({});
    initData.data = initData.data.map((obj)=>({...obj, owner : '68ce19d723b5a9b37a5eb956'}))
    await Listing.insertMany(initData.data);
    console.log("Data was Initialised");
}
initDB();