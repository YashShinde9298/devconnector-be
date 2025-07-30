import mongoose, { Schema } from "mongoose";

const postSchema = new Schema(
    {
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 5000
        },
        media: {
            url: {
                type: String,
            },
            public_id: {
                type: String
            }
        },
        tags: [
            {
                type: String
            }
        ],
        likesCount: {
            type: Number,
            default: 0
        },
        commentsCount: {
            type: Number,
            default: 0
        },
        authorId: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        authorName: {
            type: String,
            required: true
        },
        authorHeadline: {
            type: String,
            required: true
        },
        authorAvatar: {
            type: String
        }
    },
    {
        timestamps: true
    }
)

export const Post = mongoose.model('Post', postSchema);