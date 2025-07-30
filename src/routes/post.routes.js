import { Router } from "express";
import { commentOnPost, createPost, deleteComment, deletePost, getAllPosts, getPostsComment, likeUnlikePost, updatePost, getUserPosts } from "../controllers/post.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from '../middlewares/multer.middleware.js';

const router = Router();

router.route('/posts').get(verifyJWT, getAllPosts);
router.route('/post').post(verifyJWT, upload.single('media'), createPost);
router.route('/post').patch(verifyJWT, upload.single('media'), updatePost);
router.route('/post').delete(verifyJWT, deletePost);
router.route('/like-unlike-post').post(verifyJWT, likeUnlikePost);
router.route('/comment').post(verifyJWT, commentOnPost);
router.route('/comment').get(getPostsComment);
router.route('/delete').delete(verifyJWT, deleteComment);
router.route('/user-posts').get(verifyJWT, getUserPosts);

export default router;
