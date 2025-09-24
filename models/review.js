const { date, ref } = require('joi');
const mongoose = require('mongoose');
const { authorize } = require('passport');
// "/c/Program Files/MongoDB/Server/8.0/bin/mongod.exe" --dbpath="/c/data/db"
const reviewSchema = new mongoose.Schema({
     comment : String,
     rating : {
        type : Number,
        min : 1,
        max : 5,
     },
     createdAt : {
        type : Date,
        default : Date.now()
     },
     author : {
        type :mongoose.Schema.Types.ObjectId,
        ref :'User',
     },
})

module.exports = mongoose.model("Review",reviewSchema);