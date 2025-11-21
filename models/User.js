const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  connectedAccounts: {
    twitter: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      accessTokenSecret: String,
      username: String,
      userId: String
    },
    linkedin: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      profileId: String,
      name: String
    },
    facebook: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      pageId: String,
      pageName: String,
      userId: String
    },
    tiktok: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      openId: String,
      username: String
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
