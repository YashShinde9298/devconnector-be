import dotenv from 'dotenv';
import connectDB from "./db/index.js";
import { server } from './utils/socket.js';

dotenv.config({
    path: './.env'
});

connectDB().then(() => {
    server.listen(process.env.PORT || 3002, () => {
        console.log(`Server is running on port ${process.env.PORT || 3002}`);
    })
}).catch((err) => {
    console.error("MongoDB connection failed : ", err);
})
