import { Router } from "express";
import passport from "passport";
import { handleGoogleCallback } from "../controllers/auth.controller.js";

const router = Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: "select_account" }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }), handleGoogleCallback);

export default router;