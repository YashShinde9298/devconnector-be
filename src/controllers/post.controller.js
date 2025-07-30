import { Post } from "../models/Post.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from '../utils/apiResponse.js';
import { Like } from "../models/Like.model.js";
import mongoose from "mongoose";
import { Comment } from "../models/Comment.model.js";
import { Profile } from "../models/Profile.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const createPost = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { content, tags } = req.body;

    if (!userId) {
        throw new ApiError(401, "Unauthorized user");
    }
    const user = await User.findById({ _id: userId });
    const profile = await Profile.findOne({ user: userId })

    if (content?.trim() === "") {
        throw new ApiError(400, "Content is mandatory");
    }

    let localMediaFile;
    if (req.file && req.file?.path) {
        localMediaFile = await uploadOnCloudinary(req.file.path);
    }

    let parsedTags = [];
    if (tags) {
        try {
            parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
        } catch (error) {
            throw new ApiError(400, "Tags must be a valid JSON array");
        }
    }

    const post = await Post.create({
        content: content,
        media: {
            url: localMediaFile?.url,
            public_id: localMediaFile?.public_id
        },
        tags: parsedTags,
        authorId: req.user?._id,
        authorName: user.name,
        authorHeadline: profile.headline,
        authorAvatar: profile.avatar?.url
    })

    return res
        .status(200)
        .json(new ApiResponse(200, post, "Post Created successfully", true))
})

const getAllPosts = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "Unauthorized user");
    }

    const posts = await Post.aggregate([
        {
            $sort: { createdAt: -1 }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "postId",
                as: "comments"
            }
        },
        // 2. Unwind comments to prepare for deeper join
        { $unwind: { path: "$comments", preserveNullAndEmptyArrays: true } },

        // 3. Lookup user info for each comment
        {
            $lookup: {
                from: "users",
                localField: "comments.userId",
                foreignField: "_id",
                as: "commentUser"
            }
        },
        { $unwind: { path: "$commentUser", preserveNullAndEmptyArrays: true } },

        // 4. Lookup profile info to get avatar
        {
            $lookup: {
                from: "profiles",
                localField: "commentUser.userProfile",
                foreignField: "_id",
                as: "commentUserProfile"
            }
        },
        { $unwind: { path: "$commentUserProfile", preserveNullAndEmptyArrays: true } },

        // 5. Regroup comments with user + avatar info
        {
            $group: {
                _id: "$_id",
                post: { $first: "$$ROOT" },
                comments: {
                    $push: {
                        _id: "$comments._id",
                        content: "$comments.content",
                        createdAt: "$comments.createdAt",
                        updatedAt: "$comments.updatedAt",
                        userId: "$comments.userId",
                        user: {
                            name: "$commentUser.name",
                            avatar: "$commentUserProfile.avatar"
                        }
                    }
                }
            }
        },

        // 6. Merge back post fields and comments
        {
            $replaceRoot: {
                newRoot: {
                    $mergeObjects: ["$post", { comments: "$comments" }]
                }
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "postId",
                as: "comments"
            }
        },
        {
            $unwind: {
                path: "$comments",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "comments.userId",
                foreignField: "_id",
                as: "comments.user"
            }
        },
        {
            $unwind: {
                path: "$comments.user",
                preserveNullAndEmptyArrays: true
            }
        },

        // Join Profile info inside each comment's user
        {
            $lookup: {
                from: "profiles",
                localField: "comments.user.userProfile",
                foreignField: "_id",
                as: "comments.user.profile"
            }
        },
        {
            $unwind: {
                path: "$comments.user.profile",
                preserveNullAndEmptyArrays: true
            }
        },

        // Rebuild comment object with only required fields
        {
            $addFields: {
                "comments.user": {
                    name: "$comments.user.name",
                    avatar: "$comments.user.profile.avatar.url",
                    headline: "$comments.user.profile.headline"
                }
            }
        },

        // Group back the comments (since we unwound them)
        {
            $group: {
                _id: "$_id",
                content: { $first: "$content" },
                media: { $first: "$media" },
                tags: { $first: "$tags" },
                likesCount: { $first: "$likesCount" },
                commentsCount: { $first: "$commentsCount" },
                authorId: { $first: "$authorId" },
                authorName: { $first: "$authorName" },
                authorAvatar: { $first: "$authorAvatar" },
                authorHeadline: { $first: "$authorHeadline" },
                createdAt: { $first: "$createdAt" },
                updatedAt: { $first: "$updatedAt" },
                comments: { $push: "$comments" }
            }
        },
        {
            $lookup: {
                from: "likes",
                let: { postId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: ["$postId", "$$postId"],
                                    },
                                    {
                                        $eq: ["$userId", new mongoose.Types.ObjectId(userId)]
                                    }
                                ]
                            }
                        }
                    }
                ],
                as: "userLiked"
            }
        },
        {
            $addFields: {
                isLikedByCurrentUser: {
                    $gt: [
                        {
                            $size: "$userLiked"
                        },
                        0
                    ]
                }
            }
        },
        {
            $project: {
                __v: 0,
                "comments.__v": 0,
                userLiked: 0,
                "comments.userId": 0,
                "comments.user.password": 0,
                "comments.user.completenessScore": 0,
                "comments.user.createdAt": 0,
                "comments.user.updatedAt": 0,
                "comments.user.__v": 0,
                "comments.user.refreshToken": 0,
                "comments.user.userProfile": 0,
                "comments.user.profile": 0,
            }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(200, posts, "Posts fetched successfully", true));
})

const updatePost = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const postId = req.query?.id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized User");
    }

    const post = await Post.findOne({ _id: postId, authorId: userId });
    if (!post) {
        throw new ApiError(404, "Post not found");
    }

    let uploadedMedia = null;
    const { content, tags } = req.body;
    if (content) post.content = content;
    if (tags) {
        try {
            post.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
        } catch (error) {
            throw new ApiError(400, "Tags must be a valid JSON");
        }
    }
    if (req.file?.path) {
        uploadedMedia = await uploadOnCloudinary(req.file.path);
        if (post.media?.public_id) {
            await deleteFromCloudinary(post.media.public_id);
        }

        post.media = {
            url: uploadedMedia.url,
            public_id: uploadedMedia.public_id
        };
    }
    await post.save({ validateBeforeSave: false });
    return res
        .status(200)
        .json(new ApiResponse(200, post, "Post updated succesfully", true))
})

const deletePost = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const postId = req.query?.id;

    if (!userId) {
        throw new ApiError(401, "Unauthorized User")
    }
    if (!postId) {
        throw new ApiError(400, "Post id is missing");
    }
    const post = await Post.findById(postId);

    if (post) {
        await deleteFromCloudinary(post.media?.url);
    }

    await Post.findByIdAndDelete({ _id: postId, authorId: userId })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Post deleted successfully", true));
})

const likeUnlikePost = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const postId = req.query?.id;

    if (!userId) {
        throw new ApiError(401, "Unauthorized User");
    }

    const liked = await Like.findOne({ postId, userId });

    let message = "";

    if (liked) {
        await Like.deleteOne({ _id: liked._id });
        message = "Post unliked";
    } else {
        await Like.create({ postId, userId });
        message = "Post liked";
    }

    const result = await Like.aggregate([
        {
            $match: { postId: new mongoose.Types.ObjectId(postId) }
        },
        {
            $group: {
                _id: "$postId",
                totalLikes: { $sum: 1 }
            }
        }
    ]);

    const totalLikes = result.length > 0 ? result[0].totalLikes : 0;
    await Post.findByIdAndUpdate(postId, { likesCount: totalLikes });
    return res
        .status(200)
        .json(new ApiResponse(200, {}, message, true))
})

const commentOnPost = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const postId = req.query?.id;

    if (!userId) {
        throw new ApiError(401, "Unauthorized User");
    }

    const { content } = req.body;
    if (!content) {
        throw new ApiError(400, "Content is mandatory");
    }

    const comment = await Comment.create({
        content,
        userId,
        postId
    })

    if (!comment) {
        throw new ApiError(500, "Something went wrong while posting comment");
    }

    const user = await User.findById(userId).select("name email");
    const profile = await Profile.findOne({ user: userId }).select("avatar headline");

    const result = await Comment.aggregate([
        {
            $match: { postId: new mongoose.Types.ObjectId(postId) }
        },
        {
            $group: {
                _id: "$postId",
                totalComments: { $sum: 1 }
            }
        }
    ])

    const totalComments = result.length > 0 ? result[0].totalComments : 0;
    await Post.findByIdAndUpdate(postId, { commentsCount: totalComments });

    const responseComment = {
        ...comment._doc,
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: profile?.avatar?.url || null,
            headline: profile?.headline || null
        }
    };


    return res
        .status(200)
        .json(new ApiResponse(200, responseComment, "Comment posted successfully", true));
})

const getPostsComment = asyncHandler(async (req, res) => {
    const postId = req.query?.id;

    if (!postId) {
        throw new ApiError(400, "Post id not found");
    }

    const postComments = await Comment.find({ postId: postId });

    return res
        .status(200)
        .json(new ApiResponse(200, postComments, "Post comments fectehd successfully", true));
})

const deleteComment = asyncHandler(async (req, res) => {
    const commentId = req.query?.id;
    const userId = req.user?._id;

    if (!commentId) {
        throw new ApiError(400, "Comment id is required");
    }
    if (!userId) {
        throw new ApiError(401, "Unauthorized user");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    const post = await Post.findById(comment.postId);
    if (!post) {
        throw new ApiError(404, "Associated post not found");
    }

    const isCommentOwner = comment.userId.toString() === userId.toString();
    const isPostOwner = post.authorId.toString() === userId.toString();

    if (!isCommentOwner && !isPostOwner) {
        throw new ApiError(403, "You are not authorized to delete this comment");
    }

    await Comment.findByIdAndDelete(commentId);
    post.commentsCount = await Comment.countDocuments({ postId: post._id });
    await post.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Comment deleted successfully", true));

})

const getUserPosts = asyncHandler(async (req, res) => {
    const userId = req.query?.userId;
    const currentUserId = req.user?._id;

    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    if (!currentUserId) {
        throw new ApiError(401, "Unauthorized user");
    }

    const posts = await Post.aggregate([
        {
            $match: { authorId: new mongoose.Types.ObjectId(userId) }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "postId",
                as: "comments"
            }
        },
        {
            $unwind: {
                path: "$comments",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "comments.userId",
                foreignField: "_id",
                as: "comments.user"
            }
        },
        {
            $unwind: {
                path: "$comments.user",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "profiles",
                localField: "comments.user.userProfile",
                foreignField: "_id",
                as: "comments.user.profile"
            }
        },
        {
            $unwind: {
                path: "$comments.user.profile",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $addFields: {
                "comments.user": {
                    name: "$comments.user.name",
                    avatar: "$comments.user.profile.avatar.url",
                    headline: "$comments.user.profile.headline"
                }
            }
        },
        {
            $group: {
                _id: "$_id",
                content: { $first: "$content" },
                media: { $first: "$media" },
                tags: { $first: "$tags" },
                likesCount: { $first: "$likesCount" },
                commentsCount: { $first: "$commentsCount" },
                authorId: { $first: "$authorId" },
                authorName: { $first: "$authorName" },
                authorAvatar: { $first: "$authorAvatar" },
                authorHeadline: { $first: "$authorHeadline" },
                createdAt: { $first: "$createdAt" },
                updatedAt: { $first: "$updatedAt" },
                comments: { $push: "$comments" }
            }
        },
        {
            $lookup: {
                from: "likes",
                let: { postId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: ["$postId", "$$postId"],
                                    },
                                    {
                                        $eq: ["$userId", new mongoose.Types.ObjectId(currentUserId)]
                                    }
                                ]
                            }
                        }
                    }
                ],
                as: "userLiked"
            }
        },
        {
            $addFields: {
                isLikedByCurrentUser: {
                    $gt: [
                        {
                            $size: "$userLiked"
                        },
                        0
                    ]
                }
            }
        },
        {
            $project: {
                __v: 0,
                "comments.__v": 0,
                userLiked: 0,
                "comments.userId": 0,
                "comments.user.password": 0,
                "comments.user.completenessScore": 0,
                "comments.user.createdAt": 0,
                "comments.user.updatedAt": 0,
                "comments.user.__v": 0,
                "comments.user.refreshToken": 0,
                "comments.user.userProfile": 0,
                "comments.user.profile": 0,
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, posts, "User posts fetched successfully", true));
});

export { createPost, getAllPosts, updatePost, deletePost, likeUnlikePost, commentOnPost, getPostsComment, deleteComment, getUserPosts };
