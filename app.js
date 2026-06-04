if (process.env.NODE_ENV != "production") {
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
const ExpressError = require('./utils/ExpressError.js');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');

// === AUTOMATION CHROMIUM ENGINES ===
// This activates your 24-hour expiration matrix right on system boot
require("./controllers/bookingCron"); 

//routes
const listings = require('./routes/listing.js');
const bookingRouter = require("./routes/bookings");
const reviews = require('./routes/review.js');
const userRouter = require('./routes/user.js');
const newsletterRouter = require("./routes/newsletter");
const itineraryRouter = require("./routes/itinerary");
const { date } = require('joi');
let port = 3000;

//authentication
const passport = require('passport');
const localStrategy = require('passport-local');
const User = require('./models/user.js');

// Import Middleware Guard (PHASE 7 INTEGRATION)
const { isReviewEnforced } = require("./middleware.js");

// Fixed razorpay package requirement typo
const Razorpay = require('razorpay'); 
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

// === CRITICAL FIXES FOR JSON FETCH DATA HANDLING & STRUCTURING ENGINE CONTROLS ===
app.engine('ejs',ejsMate);
app.set('view engine','ejs');
app.set('views',path.join(__dirname,"views"));

app.use(express.static(path.join(__dirname,"/public")));
app.use(methodOverride('_method'));
app.use(express.urlencoded({extended : true}));
app.use(express.json()); // MANDATORY FIX: Frontend Fetch API headers data successfully read karne ke liye

const store = MongoStore.create({
    mongoUrl : dbUrl,
    crypto : {
        secret :process.env.SECRET,
    },
    touchAfter: 24*3600,
})

store.on("error", (err)=>{ // Fixed missing err reference here
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
    res.locals.razorpayKeyId = process.env.RAZORPAY_KEY_ID; 
    next();
})

// === 🛡️ GLOBAL ROUTE ENFORCEMENT INTERCEPTOR MIDDLEWARE (PHASE 7 LOCK) ===
app.use(isReviewEnforced);

app.get("/",(req,res)=>{
    res.send("Root is Working");
})

// Initialize Razorpay client
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Route to create a Razorpay order
app.post('/listings/:id/checkout', async (req, res) => {
    try {
        let listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).send("Listing not found");
        }

        const amount = listing.price * 100; // Razorpay expects amount in the smallest currency unit (paise)
        const options = {
            amount: amount,
            currency: "INR",
            receipt: `receipt_order_${Math.random().toString(36).substring(7)}`, // Generate a unique receipt ID
        };
        
        const order = await razorpay.orders.create(options);
        
        if (!order) {
            return res.status(500).send("Error creating order");
        }
        
        // Send the order details back to the frontend
        res.json(order);

    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong!");
    }
});

// === ROUTERS MOUNTING STACKS ===
app.use("/", bookingRouter); // Dynamic Booking routes fallback interface controllers handles
app.use('/listings',listings);
app.use('/listings/:id/reviews',reviews);
app.use('/',userRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/", itineraryRouter);
app.use((req, res, next) => {
    next(new ExpressError(404, 'Page Not Found!'));
});

//custom error
app.use((err, req, res, next) => {
    const { status = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!';
    res.status(status).render("./listings/error.ejs", { err });
});

app.listen(port,()=>{
    console.log(`Server is listening on port ${port}...`);
})

//cd "C:\Users\aksha\OneDrive\Desktop\AKSHAT ENTIRE WORK\SIGMA_8.0\Air_Bnb_Project"
// ssh -i "my-airbnb-key.pem" ubuntu@13.60.169.79