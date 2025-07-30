import mongoose from "mongoose";
import { User } from "../models/User.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { Message } from "../models/Message.model.js";
import { getReceiverSocketId } from "../utils/socket.js";
import { io } from "../utils/socket.js";

const getUsersForSidebar = asyncHandler(async (req, res) => {
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
            $lookup: {
                from: "messages",
                let: { sidebarUserId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$recevierId", new mongoose.Types.ObjectId(currentUserId)] },
                                    { $eq: ["$senderId", "$$sidebarUserId"] },
                                    { $eq: ["$read", false] }
                                ]
                            }
                        }
                    }
                ],
                as: "unreadMessages"
            }
        },
        {
            $addFields: {
                isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] },
                unreadCount: { $size: "$unreadMessages" }
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                avatar: { $arrayElemAt: ["$profileDetails.avatar.url", 0] },
                isFollowing: 1,
                unreadCount: 1
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, users, "Users fetched successfully", true));
})

const getMessages = asyncHandler(async (req, res) => {
    const userToChatWith = req.query?.id;
    const senderId = req.user?._id;

    const messages = await Message.find({
        $or: [
            {
                senderId: senderId,
                receiverId: userToChatWith
            },
            {
                senderId: userToChatWith,
                receiverId: senderId
            }
        ]
    })

    return res
        .status(200)
        .json(new ApiResponse(200, messages, "Messages fetched successfully", true));
})

const sendMessage = asyncHandler(async (req, res) => {
    const { text } = req.body;
    const receiverId = req.query?.id;
    const senderId = req.user?._id;
    const newMessage = await Message.create({
        senderId,
        receiverId,
        text,
        read: false
    });

    const receiverSocketId = getReceiverSocketId(receiverId);
    const senderSocketId = getReceiverSocketId(senderId);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
        io.to(receiverSocketId).emit("unreadCountUpdate", {
            from: senderId,
        });
    }
    if (senderSocketId) {
        io.to(senderSocketId).emit("newMessage", newMessage);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, newMessage, "Message sent successfully", true));
})

const updateMessageReadStatus = asyncHandler(async (req, res) => {
    const receiverId = req.user?._id;
    await Message.updateMany(
        { receiverId, read: false },
        { read: true }
    );

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageRead", receiverId);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Message read status updated successfully", true));
})

export { getUsersForSidebar, getMessages, sendMessage, updateMessageReadStatus };