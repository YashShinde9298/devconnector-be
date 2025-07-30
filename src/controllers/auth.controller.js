import { User } from "../models/User.model.js";
import { Profile } from '../models/Profile.model.js';
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();
        user.refreshToken = refreshToken;
        user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access or refresh token")
    }
}

const completenessScore = async (userId) => {
    const totalfields = 11;
    let filledfields = 0;
    const user = await User.findById(userId);
    const profile = await Profile.findOne({ user: userId });

    if (user?.name) filledfields++;
    if (user?.email) filledfields++;
    if (profile?.bio) filledfields++;
    if (profile?.location) filledfields++;
    if (profile?.avatar?.url) filledfields++;
    if (profile?.linkedInUrl) filledfields++;
    if (profile?.headline) filledfields++;
    if (profile?.skills && profile?.skills?.length > 0) filledfields++;
    if (profile?.experience && profile?.experience?.length > 0) filledfields++;
    if (profile?.education && profile?.education?.length > 0) filledfields++;
    if (profile?.certifications && profile?.certifications?.length > 0) filledfields++;
    let score = Math.round((filledfields / totalfields) * 100);
    user.completenessScore = score;
    await user.save();
}

const OPTIONS = { httpOnly: true, secure: true, sameSite: "Lax" };

const handleGoogleCallback = asyncHandler(async (req, res) => {
    const user = req.user;
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    await completenessScore(loggedInUser._id);
    const userProfile = await Profile.findOne({ user: user._id });

    return res
        .cookie("accessToken", accessToken, OPTIONS)
        .cookie("refreshToken", refreshToken, OPTIONS)
        .redirect(`${process.env.FRONTEND_URI}/google-auth?token=${accessToken}`)
        .json(new ApiResponse(200, { user: loggedInUser, accessToken, profile: userProfile }, "User logged in successfully", true))
})

export { handleGoogleCallback }