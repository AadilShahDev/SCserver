const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');
const Post = require('../models/Post');
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads - use /tmp for Vercel serverless
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use /tmp directory for Vercel serverless environment
    const uploadDir = '/tmp/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Post to Twitter
async function postToTwitter(content, mediaPath, credentials) {
  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessTokenSecret,
    });

    let mediaId;
    if (mediaPath && fs.existsSync(mediaPath)) {
      mediaId = await client.v1.uploadMedia(mediaPath);
    }

    const tweetData = {
      text: content
    };

    if (mediaId) {
      tweetData.media = { media_ids: [mediaId] };
    }

    const tweet = await client.v2.tweet(tweetData);
    
    return {
      success: true,
      postId: tweet.data.id,
      postedAt: new Date()
    };
  } catch (error) {
    console.error('Twitter posting error:', error);
    return {
      success: false,
      error: error.message || 'Failed to post to Twitter'
    };
  }
}

// Post to Facebook
async function postToFacebook(content, mediaPath, pageId, accessToken) {
  try {
    const postData = {
      message: content
    };

    let endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;

    // If media exists, use photos endpoint
    if (mediaPath && fs.existsSync(mediaPath)) {
      const formData = new FormData();
      formData.append('message', content);
      formData.append('source', fs.createReadStream(mediaPath));
      formData.append('access_token', accessToken);

      endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
      
      const response = await axios.post(endpoint, formData, {
        headers: formData.getHeaders()
      });

      return {
        success: true,
        postId: response.data.id || response.data.post_id,
        postedAt: new Date()
      };
    } else {
      // Text-only post
      const response = await axios.post(endpoint, null, {
        params: {
          message: content,
          access_token: accessToken
        }
      });

      return {
        success: true,
        postId: response.data.id,
        postedAt: new Date()
      };
    }
  } catch (error) {
    console.error('Facebook posting error:', error.response?.data || error);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to post to Facebook'
    };
  }
}

// Post to TikTok
async function postToTikTok(content, mediaPath, accessToken) {
  try {
    // TikTok requires video content
    if (!mediaPath || !fs.existsSync(mediaPath)) {
      return {
        success: false,
        error: 'TikTok requires video content'
      };
    }

    // Step 1: Initialize video upload
    const initResponse = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        post_info: {
          title: content.substring(0, 150), // TikTok title limit
          privacy_level: 'SELF_ONLY', // Options: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: fs.statSync(mediaPath).size,
          chunk_size: 10000000, // 10MB chunks
          total_chunk_count: 1
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const uploadUrl = initResponse.data.data.upload_url;
    const publishId = initResponse.data.data.publish_id;

    // Step 2: Upload video file
    const videoBuffer = fs.readFileSync(mediaPath);
    await axios.put(uploadUrl, videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4'
      }
    });

    return {
      success: true,
      postId: publishId,
      postedAt: new Date()
    };
  } catch (error) {
    console.error('TikTok posting error:', error.response?.data || error);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to post to TikTok'
    };
  }
}

// Post to LinkedIn
async function postToLinkedIn(content, mediaPath, accessToken, profileId) {
  try {
    const postData = {
      author: `urn:li:person:${profileId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: mediaPath ? 'IMAGE' : 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // If media exists, upload it first
    if (mediaPath && fs.existsSync(mediaPath)) {
      // LinkedIn image upload is more complex - simplified version here
      // In production, you'd need to implement the full LinkedIn image upload flow
      console.log('LinkedIn image upload not fully implemented in this version');
    }

    const response = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      postData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    return {
      success: true,
      postId: response.data.id,
      postedAt: new Date()
    };
  } catch (error) {
    console.error('LinkedIn posting error:', error.response?.data || error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to post to LinkedIn'
    };
  }
}

// Create and publish post
router.post('/create', authenticateToken, upload.array('media', 4), async (req, res) => {
  try {
    const { content, platforms } = req.body;
    const selectedPlatforms = JSON.parse(platforms || '[]');

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    // Get user with connected accounts
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create post record
    const post = new Post({
      userId: req.userId,
      content,
      mediaUrls: req.files ? req.files.map(f => f.path) : [],
      status: 'posting'
    });

    await post.save();

    // Post to selected platforms
    const results = {
      twitter: { posted: false },
      linkedin: { posted: false },
      facebook: { posted: false },
      tiktok: { posted: false }
    };

    const mediaPath = req.files && req.files.length > 0 ? req.files[0].path : null;

    // Post to Twitter
    if (selectedPlatforms.includes('twitter') && user.connectedAccounts.twitter.connected) {
      const twitterResult = await postToTwitter(
        content,
        mediaPath,
        user.connectedAccounts.twitter
      );

      results.twitter = {
        posted: twitterResult.success,
        postId: twitterResult.postId,
        error: twitterResult.error,
        postedAt: twitterResult.postedAt
      };

      post.platforms.twitter = results.twitter;
    }

    // Post to LinkedIn
    if (selectedPlatforms.includes('linkedin') && user.connectedAccounts.linkedin.connected) {
      const linkedinResult = await postToLinkedIn(
        content,
        mediaPath,
        user.connectedAccounts.linkedin.accessToken,
        user.connectedAccounts.linkedin.profileId
      );

      results.linkedin = {
        posted: linkedinResult.success,
        postId: linkedinResult.postId,
        error: linkedinResult.error,
        postedAt: linkedinResult.postedAt
      };

      post.platforms.linkedin = results.linkedin;
    }

    // Post to Facebook
    if (selectedPlatforms.includes('facebook') && user.connectedAccounts.facebook.connected) {
      const facebookResult = await postToFacebook(
        content,
        mediaPath,
        user.connectedAccounts.facebook.pageId,
        user.connectedAccounts.facebook.accessToken
      );

      results.facebook = {
        posted: facebookResult.success,
        postId: facebookResult.postId,
        error: facebookResult.error,
        postedAt: facebookResult.postedAt
      };

      post.platforms.facebook = results.facebook;
    }

    // Post to TikTok
    if (selectedPlatforms.includes('tiktok') && user.connectedAccounts.tiktok.connected) {
      const tiktokResult = await postToTikTok(
        content,
        mediaPath,
        user.connectedAccounts.tiktok.accessToken
      );

      results.tiktok = {
        posted: tiktokResult.success,
        postId: tiktokResult.postId,
        error: tiktokResult.error,
        postedAt: tiktokResult.postedAt
      };

      post.platforms.tiktok = results.tiktok;
    }

    // Update post status
    const successCount = (results.twitter.posted ? 1 : 0) + (results.linkedin.posted ? 1 : 0) + (results.facebook.posted ? 1 : 0) + (results.tiktok.posted ? 1 : 0);
    const totalSelected = selectedPlatforms.length;

    if (successCount === 0) {
      post.status = 'failed';
    } else if (successCount === totalSelected) {
      post.status = 'completed';
    } else {
      post.status = 'partial';
    }

    await post.save();

    // Clean up uploaded files
    if (req.files) {
      setTimeout(() => {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }, 5000);
    }

    res.json({
      message: 'Post published',
      post,
      results
    });
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's posts
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ posts });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single post
router.get('/:postId', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.postId,
      userId: req.userId
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ post });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
