import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { chatWithAssistant, improveProfile, suggestLearningTopics } from '../controllers/aiAssistant.controller.js';

const router = Router();

router.route('/career').post(verifyJWT, chatWithAssistant);
router.route('/profile-improvement').post(verifyJWT, improveProfile);
router.route('/post-suggestion').post(verifyJWT, suggestLearningTopics);

export default router;