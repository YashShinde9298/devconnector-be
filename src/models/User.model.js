import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            minlength: 5,
            maxlength: 100,
            index: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
            maxlength: 1024
        },
        userProfile: {
            type: Schema.Types.ObjectId,
            ref: "Profile"
        },
        refreshToken: {
            type: String
        },
        passwordResetToken: {
            type: String
        },
        passwordResetExpires: {
            type: Date
        },
        completenessScore: {
            type: Number,
            default: 0
        },
        connections: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
)

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
})

userSchema.methods.isPasswordCorrect = async function (password) {
    if (!password || !this.password) {
        throw new ApiError(400, "Password or hash is missing for comparison");
    }
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateAccessToken = async function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = async function () {
    return jwt.sign(
        {
            _id: this._id,
            emai: this.email,
            name: this.name
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model('User', userSchema);
