// ================================================================
// lib/passport.js: Passport.js Google OAuth 2.0 Strategy
// ================================================================
// Configures Google OAuth authentication. When a user signs in
// with Google, their email is classified into a role and their
// profile is auto-created or updated in the database.
// ================================================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { classifyRole, validateEmail } = require('./roleClassifier');

// ---- Serialize/Deserialize User for Sessions ----
// These tell Passport how to store/retrieve user info from the session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ---- Google OAuth Strategy ----
// Only register if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    !process.env.GOOGLE_CLIENT_ID.includes('your_google')) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value.toLowerCase();

          // Validate email and classify role
          const { valid, role, error } = validateEmail(email);
          if (!valid) {
            return done(null, false, { message: error });
          }

          // Don't allow Google OAuth to create a second admin
          if (role === 'admin') {
            const existingAdmin = await User.findOne({ email: 'admin@lnmiit.ac.in' });
            if (existingAdmin) {
              // Update Google profile info on existing admin
              existingAdmin.googleId = profile.id;
              existingAdmin.avatar = profile.photos?.[0]?.value || existingAdmin.avatar;
              await existingAdmin.save();
              return done(null, existingAdmin);
            }
          }

          // Check if user already exists
          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email }],
          });

          if (user) {
            // Update existing user's Google info
            if (!user.googleId) user.googleId = profile.id;
            if (!user.avatar && profile.photos?.[0]?.value) {
              user.avatar = profile.photos[0].value;
            }
            user.lastLogin = new Date();
            await user.save();
            return done(null, user);
          }

          // Create new user with auto-classified role
          user = new User({
            name: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
            email,
            googleId: profile.id,
            avatar: profile.photos?.[0]?.value || '',
            role,
            isActive: true,
            profileComplete: false,
            lastLogin: new Date(),
          });

          await user.save();
          return done(null, user);
        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
  console.log(' Google OAuth strategy configured');
} else {
  console.log('️  Google OAuth not configured, using local auth only');
}

module.exports = passport;
