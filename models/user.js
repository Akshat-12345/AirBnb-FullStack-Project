// const mongoose = require('mongoose');
// const schema = mongoose.Schema;
// const passportLocalMongoose = require('passport-local-mongoose');

// const userSchema = new schema({
//   email: {
//     type: String,
//     required: true,
//     unique: true // email ko unique bhi rakho
//   },
//   username: {
//     type: String,
//     required: true,
//     unique: true  // username bhi unique hoga
//   }

// });

// // plugin ko bol do ki username ke jagah email use karo
// userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

// module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');
const schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    // Agar Google user ka username generate na ho paye, 
    // toh error se bachne ke liye required hata sakte ho ya fallback bana sakte ho
    sparse: true 
  },
  // Naye fields (Optional / Safe for old users)
  googleId: {
    type: String,
    unique: true,
    sparse: true // Boht important: purane users jinpe googleId nahi hai unme conflict nahi hoga
  },
  twitterId: {
    type: String,
    unique: true,
    sparse: true
  },
  avatar: String
});

// Purana auth bilkul waise hi chalta rahega
userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

module.exports = mongoose.model('User', userSchema);