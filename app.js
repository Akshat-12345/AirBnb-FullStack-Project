require('dotenv').config(); // Hamesha .env load karega

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
const passport = require('passport');
const localStrategy = require('passport-local');
const User = require('./models/user.js');
const Razorpay = require('razorpay');

// Routes
const listings = require('./routes/listing.js');
const reviews = require('./routes/review.js');
const userRouter = require('./routes/user.js');

// Port Fix: AWS Security Group ke hisaab se 8080 kar diya
const port = 8080; 

// Database URL from .env
const dbUrl = process.env.ATLAS_DB;

// Database Connection
main()
    .then(() => {
        console.log("Connected To Database");
    })
    .catch((err) => {
        console.error(`Some Error Occured: ${err}`);
    });

async function main() {
    // SSL/TLS errors bypass karne ke liye options
    await mongoose.connect(dbUrl);
}

// Session Store
const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("Error In MongoDb Store", err);
});

const sessionOption = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

// Middlewares
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, "/public")));

app.use(session(sessionOption));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy({ usernameField: 'email' }, User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currUser = req.user;
    res.locals.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    next();
});

// Razorpay Setup
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Routes
app.get("/", (req, res) => {
    res.redirect("/listings");
});

app.post('/listings/:id/checkout', async (req, res) => {
    try {
        let listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).send("Listing not found");

        const options = {
            amount: listing.price * 100,
            currency: "INR",
            receipt: `receipt_order_${Math.random().toString(36).substring(7)}`,
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong!");
    }
});

app.use('/listings', listings);
app.use('/listings/:id/reviews', reviews);
app.use('/', userRouter);

// Error Handling
app.all("*", (req, res, next) => {
    next(new ExpressError(404, 'Page Not Found!'));
});

app.use((err, req, res, next) => {
    const { status = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!';
    res.status(status).render("./listings/error.ejs", { err });
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});