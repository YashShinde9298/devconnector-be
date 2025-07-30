import { Router } from 'express';
import { changePassword, createOrUpdateUserProfile, deleteProjectDetails, getUserProfile, getUserProjectDetails, loginUser, logoutUser, postProjects, registerUser, updateProjectDetails, getUserProfileById, getAllUsers, connectUser, forgotPassword, resetPassword } from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/register').post(registerUser);
router.route('/login').post(loginUser);
router.route('/logout').post(verifyJWT, logoutUser);
router.route('/profile-details').get(verifyJWT, getUserProfile);
router.route('/profile-details').put(verifyJWT, upload.single('avatar'), createOrUpdateUserProfile);
router.route('/change-password').put(verifyJWT, changePassword);
router.route('/create-projects').post(verifyJWT, postProjects);
router.route('/update-project').patch(verifyJWT, updateProjectDetails);
router.route('/delete-project').delete(verifyJWT, deleteProjectDetails);
router.route('/projects').get(verifyJWT, getUserProjectDetails);
router.route('/profile').get(verifyJWT, getUserProfileById);
router.route('/all-users').get(verifyJWT, getAllUsers);
router.route('/connect-user').post(verifyJWT, connectUser);
router.route('/forgot-password').post(forgotPassword);
router.route('/reset-password').post(resetPassword);

export default router;
