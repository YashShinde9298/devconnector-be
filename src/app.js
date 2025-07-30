import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import "./config/passport.js";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());
app.use(passport.initialize());

import userRouter from './routes/user.routes.js';
import postRouter from './routes/post.routes.js';
import authRouter from './routes/auth.routes.js';
import aiRouter from './routes/aiAssistant.routes.js';
import messageRouter from './routes/message.routes.js';

app.use('/api/v1/users', userRouter);
app.use('/api/v1/posts', postRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/messages', messageRouter);

export { app };
