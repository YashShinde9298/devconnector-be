import mongoose, { Schema } from "mongoose";

const followSchema = new Schema(
    {
        followerId: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        followingId: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    }
)

export const Follow = mongoose.model("Follow", followSchema);