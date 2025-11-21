const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  mediaUrls: [{
    type: String
  }],
  platforms: {
    twitter: {
      posted: { type: Boolean, default: false },
      postId: String,
      error: String,
      postedAt: Date
    },
    linkedin: {
      posted: { type: Boolean, default: false },
      postId: String,
      error: String,
      postedAt: Date
    },
    facebook: {
      posted: { type: Boolean, default: false },
      postId: String,
      error: String,
      postedAt: Date
    },
    tiktok: {
      posted: { type: Boolean, default: false },
      postId: String,
      error: String,
      postedAt: Date
    }
  },
  status: {
    type: String,
    enum: ['pending', 'posting', 'completed', 'failed', 'partial'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Post', postSchema);
