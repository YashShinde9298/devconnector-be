import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User.model.js";
import { Profile } from "../models/Profile.model.js";
import dotenv from "dotenv";

dotenv.config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/api/v1/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ email: profile.emails[0].value });

                if (!user) {
                    user = await User.create({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        password: "GOOGLE_AUTH",
                    });

                    await Profile.create({
                        user: user._id,
                        avatar: { url: profile.photos[0].value },
                        headline: "New Google User",
                        linkedInUrl: "",
                        location: "",
                        bio: "",
                    });
                }
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);
