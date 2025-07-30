import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { User } from '../models/User.model.js';
import { deleteFromCloudinary, uploadOnCloudinary } from '../utils/cloudinary.js';
import { OPTIONS } from '../constant.js';
import mongoose from 'mongoose';
import { Profile } from '../models/Profile.model.js';
import { Project } from '../models/Project.model.js';
import { Follow } from '../models/Follow.model.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

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

const registerUser = asyncHandler(async (req, res) => {
    const { email, name, password } = req.body;
    if ([email, name, password].some((field) => field.trim() === "")) {
        throw new ApiError(400, "All fields are mandatory");
    }

    const existedUser = await User.findOne({ email });
    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    const user = await User.create({
        name,
        email,
        password
    });

    await completenessScore(user._id);
    const createdUser = await User.findById(user._id).select('-password -refreshToken');
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while creating user");
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(createdUser._id);

    return res
        .status(201)
        .json(new ApiResponse(201, { user: createdUser, accessToken }, "User registered successfully", true));
})

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email) {
        throw new ApiError(400, "Email or password is required");
    }

    const existedUser = await User.findOne({ email });
    if (!existedUser) {
        throw new ApiError(404, "User with email does not exist");
    }

    const isPasswordValid = await existedUser.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(existedUser._id);
    const loggedInUser = await User.findById(existedUser._id).select('-password -refreshToken');
    const userProfile = await Profile.findOne({ user: existedUser._id })
    return res
        .status(200)
        .cookie("accessToken", accessToken, OPTIONS)
        .cookie("refreshToken", refreshToken, OPTIONS)
        .json(new ApiResponse(200, { user: loggedInUser, accessToken, profile: userProfile }, "User logged in successfully", true));
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    return res
        .status(200)
        .clearCookie("refreshToken", OPTIONS)
        .clearCookie('accessToken', OPTIONS)
        .json(new ApiResponse(200, {}, "User logged out successfully", true));
})

const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            },
        },
        {
            $lookup: {
                from: "profiles",
                localField: "userProfile",
                foreignField: "_id",
                as: "profileDetails",
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0,
                'profileDetails.__v': 0,
                __v: 0
            }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(200, user[0], "User profile fetched successfully", true));
})

const createOrUpdateUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized User");

    const {
        bio,
        location,
        linkedInUrl,
        headline
    } = req.body;

    let skills = [];
    let experience = [];
    let education = [];
    let certifications = [];

    try {
        if (req.body?.skills) skills = JSON.parse(req.body.skills);
        if (req.body?.experience) experience = JSON.parse(req.body.experience);
        if (req.body?.education) education = JSON.parse(req.body.education);
        if (req.body?.certifications) certifications = JSON.parse(req.body.certifications);
    } catch (error) {
        throw new ApiError(400, "Failed to parse complex fields");
    }

    const avatarLocalPath = req.file?.path;
    let avatar = null;

    if (avatarLocalPath) {
        avatar = await uploadOnCloudinary(avatarLocalPath);
        if (!avatar) throw new ApiError(500, "Failed to upload avatar");
    }

    let profile = await Profile.findOne({ user: userId });

    if (!profile) {
        profile = await Profile.create({
            user: userId,
            headline,
            bio,
            location,
            linkedInUrl,
            skills,
            experience,
            education,
            certifications,
            avatar: avatar ? { url: avatar.url, public_id: avatar.public_id } : undefined,
        });
        await User.findByIdAndUpdate(userId, { userProfile: profile._id });
    } else {
        if ("bio" in req.body) profile.bio = bio;
        if ("location" in req.body) profile.location = location;
        if ("linkedInUrl" in req.body) profile.linkedInUrl = linkedInUrl;
        if ("headline" in req.body) profile.headline = headline;
        if ("skills" in req.body) profile.skills = Array.isArray(skills) ? skills : [];
        if ("experience" in req.body) profile.experience = Array.isArray(experience) ? experience : [];
        if ("education" in req.body) profile.education = Array.isArray(education) ? education : [];
        if ("certifications" in req.body) profile.certifications = Array.isArray(certifications) ? certifications : [];

        if (avatar) {
            if (profile.avatar?.public_id) {
                await deleteFromCloudinary(profile.avatar.public_id);
            }
            profile.avatar = { url: avatar.url, public_id: avatar.public_id };
        }

        await profile.save({ validateBeforeSave: false });
    }

    await completenessScore(userId);

    const updatedUser = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(userId) }
        },
        {
            $lookup: {
                from: "profiles",
                localField: "userProfile",
                foreignField: "_id",
                as: "profileDetails"
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0,
                'profileDetails.__v': 0,
                __v: 0
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            profile.isNew ? 201 : 200,
            updatedUser,
            profile.isNew ? "Profile created successfully" : "Profile updated successfully",
            true
        )
    );
});

const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    const user = await User.findById(req.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordValid) {
        throw new ApiError(400, "Old password is invalid")
    }

    if (newPassword !== confirmNewPassword) {
        throw new ApiError(400, "New password and confirm new password is not matching");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password updated successfully", true));
})

const postProjects = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized User");
    }

    let projects = [];

    try {
        if (typeof req.body.projects === 'string') {
            projects = JSON.parse(req.body.projects)
        } else if (Array.isArray(req.body.projects)) {
            projects = req.body.projects
        }
    } catch (error) {
        throw new ApiError(400, "Projects must be valid JSON array");
    }


    if (!Array.isArray(projects) || projects.length === 0) {
        throw new ApiError(400, "At least one project is mandatory")
    }

    const validateProjects = projects.map((project, index) => {
        const { title, description, techStack, liveUrl, repoUrl } = project;

        if (!title.trim() || !description.trim()) {
            throw new ApiError(400, `Project at index ${index} is missing title or description`);
        }

        if (!Array.isArray(techStack) || techStack.length === 0) {
            throw new ApiError(400, `Project at index ${index} must include at least one technology`);
        }
        return {
            title: title.trim(),
            description: description.trim(),
            techStack: techStack.map(tech => tech.trim()),
            repoUrl: repoUrl?.trim(),
            liveUrl: liveUrl?.trim(),
            userId: userId
        }
    })

    const project = await Project.insertMany(validateProjects);

    if (!project) {
        throw new ApiError(500, "Failed to create project");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, project, "Projects added successfully", true))

})

const updateProjectDetails = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const projectId = req.query?.id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized user");
    }
    if (!projectId) {
        throw new ApiError(401, "Project id not fond");
    }

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
        throw new ApiError(404, "Project not found")
    }

    const { title, description, techStack, liveUrl, repoUrl } = req.body;
    if (title) project.title = title;
    if (description) project.description = description;
    if (liveUrl) project.liveUrl = liveUrl;
    if (repoUrl) project.repoUrl = repoUrl;
    if (techStack) {
        try {
            project.techStack = Array.isArray(techStack) ? techStack : JSON.parse(techStack);
        } catch (error) {
            throw new ApiError(400, "Invalid tech stack format");
        }
    }

    await project.save();
    return res
        .status(200)
        .json(new ApiResponse(200, project, "Project Details updated successfully", true))
})

const deleteProjectDetails = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const projectId = req.query?.id;
    if (!userId) {
        throw new ApiError(400, "Unauthorized User");
    }

    if (!projectId) {
        throw new ApiError(200, "Project Id is missing");
    }
    await Project.findOneAndDelete({ _id: projectId, userId });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Project details deleted successfully", true))
})


const getUserProjectDetails = asyncHandler(async (req, res) => {
    const userId = req.query?.id;

    if (!userId) {
        throw new ApiError(400, "User not found")
    }

    const projects = await Project.find({ userId: userId });

    return res
        .status(200)
        .json(new ApiResponse(200, projects, "Projects fetched successfully", true))
})

const getUserProfileById = asyncHandler(async (req, res) => {
    const userId = req.query?.userId;

    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(userId)
            },
        },
        {
            $lookup: {
                from: "profiles",
                localField: "userProfile",
                foreignField: "_id",
                as: "profileDetails",
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0,
                'profileDetails.__v': 0,
                __v: 0
            }
        }
    ]);

    if (!user || user.length === 0) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user[0], "User profile fetched successfully", true));
});

const getAllUsers = asyncHandler(async (req, res) => {
    const currentUserId = req.user?._id;

    const users = await User.aggregate([
        {
            $match: {
                _id: { $ne: new mongoose.Types.ObjectId(currentUserId) }
            }
        },
        {
            $lookup: {
                from: "profiles",
                localField: "userProfile",
                foreignField: "_id",
                as: "profileDetails",
            }
        },
        {
            $lookup: {
                from: "follows",
                let: { userId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$followerId", new mongoose.Types.ObjectId(currentUserId)] },
                                    { $eq: ["$followingId", "$$userId"] }
                                ]
                            }
                        }
                    }
                ],
                as: "isFollowing"
            }
        },
        {
            $addFields: {
                isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] }
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0,
                'profileDetails.__v': 0,
                __v: 0
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, users, "Users fetched successfully", true));
})

const connectUser = asyncHandler(async (req, res) => {
    const currentUserId = req.user?._id;
    const { userId } = req.body;

    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    if (currentUserId.toString() === userId) {
        throw new ApiError(400, "Cannot follow yourself");
    }

    const currentUser = await User.findById(currentUserId);
    const userToFollow = await User.findById(userId);

    if (!currentUser || !userToFollow) {
        throw new ApiError(404, "User not found");
    }

    const existingFollow = await Follow.findOne({
        followerId: currentUserId,
        followingId: userId
    });

    let message = "";
    let isFollowing = false;

    if (existingFollow) {
        await Follow.deleteOne({ _id: existingFollow._id });

        currentUser.connections = Math.max(0, currentUser.connections - 1);
        userToFollow.connections = Math.max(0, userToFollow.connections - 1);

        message = "User unfollowed successfully";
        isFollowing = false;
    } else {
        await Follow.create({
            followerId: currentUserId,
            followingId: userId
        });

        currentUser.connections += 1;
        userToFollow.connections += 1;

        message = "User followed successfully";
        isFollowing = true;
    }

    await currentUser.save();
    await userToFollow.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {
            isFollowing: isFollowing,
            connectionsCount: currentUser.connections
        }, message, true));
})

const getUserFollowers = asyncHandler(async (req, res) => {
    const userId = req.query?.userId;

    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    const followers = await Follow.aggregate([
        {
            $match: {
                followingId: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "followerId",
                foreignField: "_id",
                as: "followerDetails"
            }
        },
        {
            $lookup: {
                from: "profiles",
                localField: "followerDetails.userProfile",
                foreignField: "_id",
                as: "profileDetails"
            }
        },
        {
            $project: {
                "followerDetails.password": 0,
                "followerDetails.refreshToken": 0,
                "profileDetails.__v": 0,
                __v: 0
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, followers, "Followers fetched successfully", true));
})

const getUserFollowing = asyncHandler(async (req, res) => {
    const userId = req.query?.userId;

    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    const following = await Follow.aggregate([
        {
            $match: {
                followerId: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "followingId",
                foreignField: "_id",
                as: "followingDetails"
            }
        },
        {
            $lookup: {
                from: "profiles",
                localField: "followingDetails.userProfile",
                foreignField: "_id",
                as: "profileDetails"
            }
        },
        {
            $project: {
                "followingDetails.password": 0,
                "followingDetails.refreshToken": 0,
                "profileDetails.__v": 0,
                __v: 0
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, following, "Following fetched successfully", true));
})

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User with this email does not exist");
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 10 * 60 * 1000;

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.FRONTEND_URI}/reset-password?token=${resetToken}`;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset Request - DevConnector',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Password Reset Request</h2>
                <p>Hello,</p>
                <p>You requested a password reset for your DevConnector account.</p>
                <p>Click the button below to reset your password:</p>
                <a href="${resetURL}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
                <p>Or copy and paste this link in your browser:</p>
                <p style="word-break: break-all; color: #6B7280;">${resetURL}</p>
                <p><strong>This link will expire in 10 minutes.</strong></p>
                <p>If you didn't request this password reset, please ignore this email.</p>
                <p>Best regards,<br>DevConnector Team</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return res
            .status(200)
            .json(new ApiResponse(200, {}, "Password reset email sent successfully", true));
    } catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        throw new ApiError(500, "Error sending email. Please try again later.");
    }
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
        throw new ApiError(400, "All fields are required");
    }

    if (newPassword !== confirmPassword) {
        throw new ApiError(400, "Passwords do not match");
    }

    if (newPassword.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters long");
    }

    const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset token");
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password reset successfully", true));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile,
    createOrUpdateUserProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    postProjects,
    updateProjectDetails,
    deleteProjectDetails,
    getUserProjectDetails,
    getUserProfileById,
    getAllUsers,
    connectUser,
    getUserFollowers,
    getUserFollowing
};
