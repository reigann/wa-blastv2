const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { findOrCreateUser, createSessionToken } = require('./googleAuthService');

// Configure Google OAuth Strategy
function configureGoogleStrategy() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';
  const invalidClientId = !clientID || clientID.includes('your-google-client-id');
  const invalidClientSecret = !clientSecret || clientSecret.includes('your-google-client-secret');

  if (invalidClientId || invalidClientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be real values in backend .env');
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateUser(profile);
          const sessionData = await createSessionToken(user.id);
          return done(null, { user, sessionData });
        } catch (error) {
          console.error('Google Strategy error:', error);
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((obj, done) => {
    done(null, obj);
  });

  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });
}

module.exports = { configureGoogleStrategy };
