import mongoose from "mongoose";
import { createMultiDbModel } from "../../../shared/db/connect.js";

const creditLedgerSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    paymentId: {
        type: String,
        required: true
    },
    amount: {
        type: Number
    },
    credits: {
        type: Number,
        required: true
    },
    plan: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["settled"],
        default: "settled"
    },
    settledAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const CreditLedger = createMultiDbModel("billing", "CreditLedger", creditLedgerSchema);
export default CreditLedger;
