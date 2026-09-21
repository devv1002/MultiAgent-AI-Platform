import mongoose from "mongoose"

import dotenv from "dotenv";
dotenv.config();

const connectDB = async() => {
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("db connected")
    } catch (error) {
        console.log(`db error ${error}`)
    }
}

export default connectDB;