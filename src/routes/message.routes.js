import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { getUsersForSidebar, getMessages, sendMessage, updateMessageReadStatus } from '../controllers/message.controller.js';

const router = Router();

router.route('/users').get(verifyJWT, getUsersForSidebar);
router.route('/messages').get(verifyJWT, getMessages);
router.route('/send-message').post(verifyJWT, sendMessage);
router.route('/read').put(verifyJWT, updateMessageReadStatus);

export default router;