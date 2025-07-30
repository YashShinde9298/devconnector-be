import mongoose from 'mongoose';
import { DB_NAME } from '../constant.js';

const connectDB = async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log("MongoDb connecteed successfully");
    } catch (err) {
        console.error("Error connectiong to the database: ", err);
        process.exit(1);
    }
}

export default connectDB;