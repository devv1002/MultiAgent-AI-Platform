import mongoose from "mongoose";
import { createMultiDbModel } from "../../../shared/db/connect.js";

const userSchema=new mongoose.Schema({
    firebaseUid:{
        type:String,
        unique:true
    },
    name:String,
    email:String,
    avatar:String,
    plan:{
        type:String,
        default:"free"
    },
    credits:{
        type:Number,
        default:100
    },
    totalCredits:{
        type:Number,
        default:100
    },
    planExpiresAt:Date,
    settledOrders:{
        type:[String],
        default:[]
    }
},{
    timestamps:true
})

const User = createMultiDbModel("auth", "User", userSchema);
export default User