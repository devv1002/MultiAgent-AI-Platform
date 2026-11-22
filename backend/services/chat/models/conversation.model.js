import mongoose from "mongoose";
import { createMultiDbModel } from "../../../shared/db/connect.js";

const conversationSchema = new mongoose.Schema({
    title:{
        type:String,
        default:"New Chat"
    },
    userId:{
        type:String
    }
},{
    timestamps:true
})

const Conversation = createMultiDbModel("chat", "Conversation", conversationSchema)
export default Conversation