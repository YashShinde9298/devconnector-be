import mongoose, { Schema } from 'mongoose';

const profileSchema = new Schema(
    {
        headline: {
            type: String,
        },
        skills: [
            {
                type: String
            }
        ],
        avatar: {
            url: {
                type: String,
                required: true
            },
            public_id: {
                type: String
            }
        },
        bio: {
            type: String,
            required: true,
            maxlength: 500
        },
        location: {
            type: String,
            required: true,
            maxlength: 100
        },
        linkedInUrl: {
            required: true,
            type: String,
        },
        experience: [
            {
                company: {
                    type: String,
                },
                position: {
                    type: String,
                },
                startDate: {
                    type: Date,
                },
                endDate: {
                    type: Date,
                },
                present: {
                    type: Boolean,
                    default: false
                },
                description: {
                    type: String,
                }
            }
        ],
        education: [
            {
                instituteName: {
                    type: String,
                },
                degree: {
                    type: String,
                },
                startDate: {
                    type: Date,
                },
                endDate: {
                    type: Date,
                }
            }
        ],
        certifications: [
            {
                name: {
                    type: String,
                },
                issuingOrganization: {
                    type: String
                },
                issueDate: {
                    type: Date,
                },
                certificateNumber: {
                    type: Date,
                },
                url: {
                    type: String
                }
            }
        ],
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true
    }
)

export const Profile = mongoose.model('Profile', profileSchema); 