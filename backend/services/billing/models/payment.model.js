import mongoose from "mongoose";
import { createMultiDbModel } from "../../../shared/db/connect.js";

const paymentSchema=new mongoose.Schema({
    userId:{
        type:String,
        required:true
    },
    orderId:{
        type:String,
        required:true
    },
    paymentId:String,
    amount:Number,
    currency:{
        type:String,
        default:"INR"
    },
    credits:{
        type:Number
    },
    plan:{
        type:String
    },
    status:{
        type:String,
        enum:["created","paid","failed"],
        default:"created"
    },
    settlementStatus:{
        type:String,
        enum:["pending","processing","completed","failed"],
        default:"pending"
    },
    settledAt:Date,
    settlementAttempts:{
        type:Number,
        default:0
    },
    lastSettlementAttemptAt:Date,
    creditUpdateError: String
},{timestamps:true})

paymentSchema.index({ status: 1, settlementStatus: 1 });


const Payment = createMultiDbModel("billing", "Payment", paymentSchema);
export default Payment