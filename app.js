if(process.env.NODE_ENV != "production"){
   require('dotenv').config();
}
console.log(process.env.SECRET)

const express = require('express');
const ejs = require('ejs');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require("method-override");
const Listing = require('./models/listing.js');
const app = express();
const ejsMate = require('ejs-mate');
// const wrapAsync = require('./utils/wrapAsync.js');
const ExpressError = require('./utils/ExpressError.js');
// const { listingSchema, reviewSchema } = require('./schema.js');
// const Review = require('./models/review.js');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
//routes
const listings = require('./routes/listing.js');
const reviews = require('./routes/review.js');
const  userRouter = require('./routes/user.js');
const { date } = require('joi');
let port = 3000;
//authentication
const passport = require('passport');
const localStrategy = require('passport-local');
const User = require('./models/user.js');
const dbUrl = process.env.ATLAS_DB;
main()
   .then(()=>{
    console.log("Connected To Database");
   })
   .catch((err)=>{
    console.error(`Some Error Occured: ${err}`);
   })

async function main() {
    mongoose.connect(dbUrl);
}


const store = MongoStore.create({
    mongoUrl : dbUrl,
    crypto : {
        secret :process.env.SECRET,
    },
    touchAfter: 24*3600,
})

store.on("error", ()=>{
    console.log("Error In MongoDb Store",err);
})
const sessionOption = {
    store,
    secret :process.env.SECRET,
    resave : false,
    saveUninitialized :true,
    cookie: {
        expires : Date.now() + 7*24*60*60*1000,
        maxAge :  7*24*60*60*1000,
        httpOnly : true
    }
}

app.use(session(sessionOption));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy({ usernameField: 'email' },User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/demo',async(req,res)=>{
    let fakeUser = new User({
        email :'student@gmail.com',
        username : 'dleta-student',
    })
    let registeredUser = await User.register(fakeUser,'helloworld');
    res.send(registeredUser);
})
app.use((req,res,next)=>{
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currUser = req.user;
    next();
})
app.engine('ejs',ejsMate);
app.set('view engine','ejs');
app.set('views',path.join(__dirname,"views"));
app.use(express.urlencoded({extended : true}));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname,"/public")));

app.listen(port,()=>{
    console.log('Server is listening...');
})

app.get("/",(req,res)=>{
    res.send("Root is Working");
})

app.use('/listings',listings);
app.use('/listings/:id/reviews',reviews);
app.use('/',userRouter);

app.use((req, res, next) => {
    next(new ExpressError(404, 'Page Not Found!'));
});

//custom error
app.use((err, req, res, next) => {
    const { status = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!';
    res.status(status).render("./listings/error.ejs", { err });
});




