const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
        },
        async (accessToken, refreshToken, profile, done) => {
            const googleId = profile.id;
            const name = profile.displayName;
            const email = profile.emails[0].value;
            const avatar = profile.photos[0]?.value || '';
            try {
                let user = await User.findOne({ googleId });
                if (user) {
                    user.name = name;
                    user.avatar = avatar;
                    await user.save();
                } else {
                    user = await User.create({
                        googleId,
                        name,
                        email,
                        avatar,
                        semester: 1,
                        plan: 'free',
                    });
                }
                return done(null, user);  // just pass the user
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

module.exports = passport;