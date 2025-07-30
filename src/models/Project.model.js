import mongoose, { Schema } from "mongoose";

const projectSchema = new Schema(
    {
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        repoUrl: {
            type: String
        },
        liveUrl: {
            type: String
        },
        techStack: [
            {
                type: String,
                required: true
            }
        ],
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true

    }
)

export const Project = mongoose.model("Project", projectSchema);