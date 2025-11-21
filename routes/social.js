const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

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

// Connect Twitter Account
router.post('/connect/twitter', authenticateToken, async (req, res) => {
  try {
    const { accessToken, accessTokenSecret, username, userId } = req.body;

    // Verify Twitter credentials by making a test API call
    const twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: accessToken,
      accessSecret: accessTokenSecret,
    });

    // Verify credentials
    const verifyUser = await twitterClient.v2.me();

    // Update user in database
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'connectedAccounts.twitter': {
          connected: true,
          accessToken,
          accessTokenSecret,
          username: verifyUser.data.username,
          userId: verifyUser.data.id
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Twitter account connected successfully',
      connectedAccounts: user.connectedAccounts
    });
  } catch (error) {
    console.error('Twitter connection error:', error);
    res.status(500).json({ 
      message: 'Failed to connect Twitter account',
      error: error.message 
    });
  }
});

// Connect LinkedIn Account
router.post('/connect/linkedin', authenticateToken, async (req, res) => {
  try {
    const { accessToken } = req.body;

    // Verify LinkedIn token by fetching user profile
    const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const profile = response.data;

    // Update user in database
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'connectedAccounts.linkedin': {
          connected: true,
          accessToken,
          profileId: profile.sub,
          name: profile.name
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'LinkedIn account connected successfully',
      connectedAccounts: user.connectedAccounts
    });
  } catch (error) {
    console.error('LinkedIn connection error:', error);
    res.status(500).json({ 
      message: 'Failed to connect LinkedIn account',
      error: error.message 
    });
  }
});

// Disconnect Twitter
router.post('/disconnect/twitter', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'connectedAccounts.twitter': {
          connected: false,
          accessToken: null,
          accessTokenSecret: null,
          username: null,
          userId: null
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Twitter account disconnected',
      connectedAccounts: user.connectedAccounts
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Connect Facebook Account
router.post('/connect/facebook', authenticateToken, async (req, res) => {
  try {
    const { accessToken, pageId } = req.body;

    console.log('Connecting Facebook - Page ID:', pageId);

    // Verify the token is a Page Access Token by fetching page info directly
    const pageResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
      params: {
        fields: 'id,name,access_token',
        access_token: accessToken
      }
    });

    console.log('Page verified:', pageResponse.data);

    // Update user in database
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'connectedAccounts.facebook': {
          connected: true,
          accessToken: accessToken,
          pageId: pageResponse.data.id,
          pageName: pageResponse.data.name,
          userId: pageId
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Facebook account connected successfully',
      connectedAccounts: user.connectedAccounts
    });
  } catch (error) {
    console.error('Facebook connection error:', error.response?.data || error);
    res.status(500).json({ 
      message: 'Failed to connect Facebook account. Make sure you are using a Page Access Token with proper permissions.',
      error: error.response?.data?.error?.message || error.message,
      details: error.response?.data
    });
  }
});

// Connect TikTok Account
router.post('/connect/tiktok', authenticateToken, async (req, res) => {
  try {
    const { accessToken, openId } = req.body;

    // Verify TikTok token by fetching user info
    const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: {
        fields: 'open_id,display_name,username'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const userData = response.data.data.user;

    // Update user in database
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'connectedAccounts.tiktok': {
          connected: true,
          accessToken,
          openId: userData.open_id || openId,
          username: userData.username || userData.display_name
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'TikTok account connected successfully',
      connectedAccounts: user.connectedAccounts
    });
  } catch (error) {
    console.error('TikTok connection error:', error);
    res.status(500).json({ 
      message: 'Failed to connect TikTok account',
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

// Disconnect LinkedIn
router.post('/disconnect/linkedin', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'connectedAccounts.linkedin': {
          connected: false,
          accessToken: null,
          profileId: null,
          name: null
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'LinkedIn account disconnected',
      connectedAccounts: user.connectedAccounts
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Disconnect Facebook
router.post('/disconnect/facebook', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'connectedAccounts.facebook': {
          connected: false,
          accessToken: null,
          pageId: null,
          pageName: null,
          userId: null
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Facebook account disconnected',
      connectedAccounts: user.connectedAccounts
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Disconnect TikTok
router.post('/disconnect/tiktok', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        'connectedAccounts.tiktok': {
          connected: false,
          accessToken: null,
          openId: null,
          username: null
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'TikTok account disconnected',
      connectedAccounts: user.connectedAccounts
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get connected accounts status
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('connectedAccounts');
    res.json({ connectedAccounts: user.connectedAccounts });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
