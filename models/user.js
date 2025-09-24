const mongoose = require('mongoose');
const schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new schema({
  email: {
    type: String,
    required: true,
    unique: true // email ko unique bhi rakho
  },
  username: {
    type: String,
    required: true,
    unique: true  // username bhi unique hoga
  }

});

// plugin ko bol do ki username ke jagah email use karo
userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

module.exports = mongoose.model('User', userSchema);
