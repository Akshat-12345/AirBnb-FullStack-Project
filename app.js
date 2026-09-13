if (process.env.NODE_ENV != "production") {
    require('dotenv').config();
}

console.log(process.env.SECRET);

const express = require('express');
const ejs = require('ejs');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const Listing = require('./models/listing.js');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 
app.use(cookieParser());

const ejsMate = require('ejs-mate');
const ExpressError = require('./utils/ExpressError.js');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');

// === AUTOMATION CHROMIUM ENGINES ===
require("./controllers/bookingCron"); 

// Routes
const listings = require('./routes/listing.js');
const bookingRouter = require("./routes/bookings");
const reviews = require('./routes/review.js');
const userRouter = require('./routes/user.js');
const newsletterRouter = require("./routes/newsletter");
const itineraryRouter = require("./routes/itinerary");
const { date } = require('joi');
let port = 3000;

// Authentication Packages & Model
const passport = require('passport');
const localStrategy = require('passport-local');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/user.js');

// Import Middleware Guard
const { isReviewEnforced } = require("./middleware.js");

const Razorpay = require('razorpay'); 
const dbUrl = process.env.ATLAS_DB;

main()
   .then(() => {
    console.log("Connected To Database");
   })
   .catch((err) => {
    console.error(`Some Error Occured: ${err}`);
   });

async function main() {
    mongoose.connect(dbUrl);
}

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "/public")));
app.use(methodOverride('_method'));

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

app.use(session(sessionOption));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// 1. Local Strategy Configuration
passport.use(new localStrategy({ usernameField: 'email' }, User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// 2. Google OAuth Strategy Configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        const photo = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;

        // User match check
        let user = await User.findOne({
          $or: [{ googleId: profile.id }, { email: email }],
        });

        if (user) {
          let isUpdated = false;
          if (!user.googleId) {
            user.googleId = profile.id;
            isUpdated = true;
          }
          if (!user.avatar && photo) {
            user.avatar = photo;
            isUpdated = true;
          }
          if (isUpdated) await user.save();

          return done(null, user);
        }

        // Create new user if not found
        user = await User.create({
          email: email,
          username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(100 + Math.random() * 900),
          googleId: profile.id,
          avatar: photo,
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

app.get('/demo', async (req, res) => {
    let fakeUser = new User({
        email: 'student@gmail.com',
        username: 'dleta-student',
    });
    let registeredUser = await User.register(fakeUser, 'helloworld');
    res.send(registeredUser);
});

// Flash messages & Current User Resolver (Session + JWT Cookie Sync)
app.use(async (req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');

    if (!req.user && req.cookies?.token) {
        try {
            const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id);
        } catch (e) {
            res.clearCookie('token');
        }
    }

    res.locals.currUser = req.user;
    res.locals.razorpayKeyId = process.env.RAZORPAY_KEY_ID; 
    next();
});

app.use(isReviewEnforced);

app.get("/", (req, res) => {
    res.send("Root is Working");
});

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post('/listings/:id/checkout', async (req, res) => {
    try {
        let listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).send("Listing not found");
        }

        const amount = listing.price * 100; 
        const options = {
            amount: amount,
            currency: "INR",
            receipt: `receipt_order_${Math.random().toString(36).substring(7)}`, 
        };
        
        const order = await razorpay.orders.create(options);
        
        if (!order) {
            return res.status(500).send("Error creating order");
        }
        
        res.json(order);

    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong!");
    }
});

// === ROUTERS MOUNTING STACKS ===
app.use("/", bookingRouter); 
app.use('/listings', listings);
app.use('/listings/:id/reviews', reviews);
app.use('/', userRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/", itineraryRouter);

app.use((req, res, next) => {
    next(new ExpressError(404, 'Page Not Found!'));
});

// Custom Error Handler
app.use((err, req, res, next) => {
    const { status = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!';
    res.status(status).render("./listings/error.ejs", { err });
});

const server = app.listen(port, () => {
    console.log(`Server is listening on port ${port}...`);
});
server.timeout = 600000;

//cd "C:\Users\aksha\OneDrive\Desktop\AKSHAT ENTIRE WORK\SIGMA_8.0\Air_Bnb_Project"
// ssh -i "my-airbnb-key.pem" ubuntu@13.60.169.79