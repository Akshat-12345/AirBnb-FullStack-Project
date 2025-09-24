const express = require('express');
const router = express.Router({mergeParams :true});
const ExpressError = require('../utils/ExpressError.js');
const wrapAsync = require('../utils/wrapAsync.js');
const User = require('../models/user.js');
const passport = require('passport');
const{ saveRedirectUrl } = require('../middleware.js');
const userController = require('../controllers/users.js');

router.get('/signup',userController.signUp);

router.post('/signup',wrapAsync(userController.createAccount));

router.get('/login',userController.renderLoginForm);

router.post('/login',saveRedirectUrl,passport.authenticate('local',{failureRedirect : '/login',failureFlash :true}),userController.Loginuser);

router.get('/logout',userController.logout);
module.exports = router;