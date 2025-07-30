import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema(
    {
        content: {
            type: String,
            required: true
        },
        postId: {
            type: Schema.Types.ObjectId,
            ref: "Post"
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
)

export const Comment = mongoose.model("Comment", commentSchema);