import axios from "axios";
import { PLANS } from "../config/Plans.js";
import razorpay from "../config/razorpay.js";
import Payment from "../models/payment.model.js";
import CreditLedger from "../models/creditLedger.model.js";
import User from "../../auth/models/user.model.js";
import crypto from "crypto";
import { updateUserPaymentDirect } from "../../auth/controllers/auth.controller.js";

/**
 * 1. Create Order
 * Initializes Razorpay order and creates a Payment record with:
 * - status: "created"
 * - settlementStatus: "pending"
 */
export const createOrder = async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.headers["x-user-id"];
        const selectedPlan = PLANS[plan];

        if (!selectedPlan) {
            return res.status(404).json({ message: "plan not found" });
        }

        const order = await razorpay.orders.create({
            amount: selectedPlan.amount * 100,
            currency: "INR",
            receipt: `receipt-${Date.now()}`
        });

        await Payment.create({
            userId,
            orderId: order.id,
            amount: selectedPlan.amount,
            credits: selectedPlan.credits,
            plan: selectedPlan.id,
            currency: order.currency,
            status: "created",
            settlementStatus: "pending"
        });

        return res.status(200).json({ order, plan: selectedPlan });

    } catch (error) {
        return res.status(500).json({ message: `create order error ${error.message || error}` });
    }
};

/**
 * Core Idempotent Settlement Engine with Fencing Tokens
 * Safely grants user credits and updates settlement state.
 *
 * Guarantees:
 * - Atomic settlement lock prevents concurrent worker collision.
 * - Fencing token (settlementAttempts) prevents stale/stalled workers from overwriting newer worker states.
 * - Idempotent ledger (CreditLedger) and user.settledOrders prevent double-crediting.
 * - Reconciles any divergence between CreditLedger and user.settledOrders safely.
 * - Crash-safe: if server crashes at any point, retry or recovery completes settlement without duplicate credits.
 */
export const settlePaymentDirect = async (paymentIdentifier) => {
    const payment = typeof paymentIdentifier === "string"
        ? await Payment.findOne({ $or: [{ orderId: paymentIdentifier }, { _id: paymentIdentifier }] })
        : paymentIdentifier;

    if (!payment) {
        throw new Error("Payment record not found for settlement");
    }

    // 1. Guard: If already completed, return immediately
    if (payment.settlementStatus === "completed") {
        return {
            success: true,
            alreadySettled: true,
            payment
        };
    }

    // 2. Guard: Payment must be verified ("paid")
    if (payment.status !== "paid") {
        throw new Error(`Cannot settle payment with status: ${payment.status}. Payment must be 'paid'.`);
    }

    // 3. Acquire atomic settlement lock
    // Transition from "pending", "failed", or stale "processing" (> 60s) to "processing"
    const staleThreshold = new Date(Date.now() - 60 * 1000);
    const lockedPayment = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            status: "paid",
            $or: [
                { settlementStatus: { $in: ["pending", "failed"] } },
                { settlementStatus: "processing", lastSettlementAttemptAt: { $lt: staleThreshold } },
                { settlementStatus: { $exists: false } }
            ]
        },
        {
            $set: {
                settlementStatus: "processing",
                lastSettlementAttemptAt: new Date()
            },
            $inc: { settlementAttempts: 1 }
        },
        { returnDocument: "after" }
    );

    if (!lockedPayment) {
        // Another worker is actively processing settlement or it just completed
        const recheck = await Payment.findById(payment._id);
        if (recheck && recheck.settlementStatus === "completed") {
            return { success: true, alreadySettled: true, payment: recheck };
        }
        return {
            success: false,
            inProgress: true,
            message: "Payment settlement is currently in progress by another worker",
            payment: recheck
        };
    }

    // Fencing token: Record the exact lock attempt generation held by this worker
    const lockGeneration = lockedPayment.settlementAttempts;

    try {
        // 4. Pre-settlement Crash Recovery Check:
        // Check if credits were already applied to CreditLedger or User before an unexpected crash
        const existingLedger = await CreditLedger.findOne({ orderId: lockedPayment.orderId });
        const user = await User.findById(lockedPayment.userId);
        const alreadyInUser = Boolean(user?.settledOrders && user.settledOrders.includes(lockedPayment.orderId));

        if (existingLedger || alreadyInUser) {
            // RECONCILIATION: If CreditLedger has orderId but user.settledOrders does not,
            // safely reconcile using updateUserPaymentDirect to ensure user receives credits!
            if (existingLedger && !alreadyInUser) {
                console.log(`[Reconciliation Notice] CreditLedger exists for ${lockedPayment.orderId} but user marker is missing. Reconciling user credits safely...`);
                if (typeof updateUserPaymentDirect === "function") {
                    await updateUserPaymentDirect({
                        userId: lockedPayment.userId,
                        plan: lockedPayment.plan,
                        credits: lockedPayment.credits,
                        orderId: lockedPayment.orderId
                    });
                } else if (process.env.AUTH_SERVICE) {
                    await axios.post(`${process.env.AUTH_SERVICE}/update-plan`, {
                        userId: lockedPayment.userId,
                        plan: lockedPayment.plan,
                        credits: lockedPayment.credits,
                        orderId: lockedPayment.orderId
                    });
                }
            }

            // Ensure CreditLedger entry exists if user was credited but ledger wasn't created
            if (!existingLedger) {
                try {
                    await CreditLedger.create({
                        userId: lockedPayment.userId,
                        orderId: lockedPayment.orderId,
                        paymentId: lockedPayment.paymentId || "recovered_payment",
                        amount: lockedPayment.amount,
                        credits: lockedPayment.credits,
                        plan: lockedPayment.plan,
                        settledAt: new Date(),
                        status: "settled"
                    });
                } catch (lErr) {
                    if (lErr.code !== 11000) console.warn("Ledger insert note:", lErr.message);
                }
            }

            // FENCING TOKEN CHECK: Only transition to completed if this worker still holds the lock generation
            const completedPayment = await Payment.findOneAndUpdate(
                {
                    _id: lockedPayment._id,
                    settlementAttempts: lockGeneration, // Fencing Token
                    settlementStatus: "processing"
                },
                {
                    $set: {
                        settlementStatus: "completed",
                        settledAt: existingLedger?.settledAt || new Date(),
                        creditUpdateError: null
                    }
                },
                { returnDocument: "after" }
            );

            if (!completedPayment) {
                console.warn(`[Fencing Token Notice] Worker lost lock ownership for payment ${lockedPayment.orderId} (generation: ${lockGeneration})`);
                const recheck = await Payment.findById(lockedPayment._id);
                return {
                    success: recheck?.settlementStatus === "completed",
                    alreadySettled: true,
                    lostLock: true,
                    payment: recheck
                };
            }

            return {
                success: true,
                alreadySettled: true,
                payment: completedPayment
            };
        }

        // 5. Apply user credits atomically via updateUserPaymentDirect with orderId
        let creditResult;
        if (typeof updateUserPaymentDirect === "function") {
            creditResult = await updateUserPaymentDirect({
                userId: lockedPayment.userId,
                plan: lockedPayment.plan,
                credits: lockedPayment.credits,
                orderId: lockedPayment.orderId
            });
        } else if (process.env.AUTH_SERVICE) {
            const resp = await axios.post(`${process.env.AUTH_SERVICE}/update-plan`, {
                userId: lockedPayment.userId,
                plan: lockedPayment.plan,
                credits: lockedPayment.credits,
                orderId: lockedPayment.orderId
            });
            creditResult = resp.data;
        } else {
            throw new Error("No available credit update handler");
        }

        // 6. Record in CreditLedger (unique orderId index guarantees single entry)
        try {
            await CreditLedger.create({
                userId: lockedPayment.userId,
                orderId: lockedPayment.orderId,
                paymentId: lockedPayment.paymentId || "direct_settlement",
                amount: lockedPayment.amount,
                credits: lockedPayment.credits,
                plan: lockedPayment.plan,
                settledAt: new Date(),
                status: "settled"
            });
        } catch (ledgerErr) {
            if (ledgerErr.code !== 11000) {
                console.warn("[CreditLedger Warning] Ledger create error:", ledgerErr.message);
            }
        }

        // 7. Transition settlementStatus to "completed" WITH FENCING TOKEN
        const completedPayment = await Payment.findOneAndUpdate(
            {
                _id: lockedPayment._id,
                settlementAttempts: lockGeneration, // Fencing Token
                settlementStatus: "processing"
            },
            {
                $set: {
                    settlementStatus: "completed",
                    settledAt: new Date(),
                    creditUpdateError: null
                }
            },
            { returnDocument: "after" }
        );

        if (!completedPayment) {
            console.warn(`[Fencing Token Notice] Worker lost lock ownership for payment ${lockedPayment.orderId} (generation: ${lockGeneration})`);
            const recheck = await Payment.findById(lockedPayment._id);
            return {
                success: recheck?.settlementStatus === "completed",
                alreadySettled: true,
                lostLock: true,
                payment: recheck
            };
        }

        return {
            success: true,
            alreadySettled: creditResult?.alreadySettled || false,
            payment: completedPayment
        };

    } catch (settleError) {
        console.error(`[Settlement Error] Failed settling payment ${lockedPayment.orderId}:`, settleError.message);

        // FENCING TOKEN CHECK ON FAILURE:
        // Mark settlement status as "failed" ONLY if this worker still holds the lock generation!
        // If another worker superseded this lock, DO NOT overwrite the newer worker's status!
        const failedPayment = await Payment.findOneAndUpdate(
            {
                _id: lockedPayment._id,
                settlementAttempts: lockGeneration, // Fencing Token
                settlementStatus: "processing"
            },
            {
                $set: {
                    settlementStatus: "failed",
                    creditUpdateError: settleError.message
                }
            },
            { returnDocument: "after" }
        );

        if (!failedPayment) {
            console.warn(`[Fencing Token Notice] Stale worker aborted marking payment ${lockedPayment.orderId} as failed because lock ownership was superseded (generation: ${lockGeneration})`);
        }

        throw settleError;
    }
};

/**
 * 2. Verify Payment
 * Separates Payment Signature Verification from Credit Settlement.
 *
 * Flow:
 * 1. Validate signature & ownership.
 * 2. If already paid & settlement completed -> return 200 immediately.
 * 3. If already paid but settlement pending/failed/stale -> resume settlement safely.
 * 4. If newly created -> atomically set status to "paid", then invoke settlePaymentDirect.
 */
export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // 1. Validate required payload parameters
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: "Missing required payment verification parameters" });
        }

        // 2. Validate HMAC SHA-256 signature
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const expectedBuf = Buffer.from(expectedSignature, "utf8");
        const receivedBuf = Buffer.from(razorpay_signature, "utf8");
        const isSignatureValid = expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

        if (!isSignatureValid) {
            return res.status(400).json({ message: "Payment Verification Failed: Invalid Signature" });
        }

        // 3. Find payment record and verify order exists
        const existingPayment = await Payment.findOne({ orderId: razorpay_order_id });
        if (!existingPayment) {
            return res.status(404).json({ message: "Payment Record Not Found" });
        }

        // 4. Verify payment ownership if user context is available
        const currentUserId = req.headers["x-user-id"];
        if (currentUserId && String(existingPayment.userId) !== String(currentUserId)) {
            return res.status(403).json({ message: "Unauthorized: Payment does not belong to the current user" });
        }

        // 5. If already marked paid and settlement is already completed
        if (existingPayment.status === "paid" && (!existingPayment.settlementStatus || existingPayment.settlementStatus === "completed")) {
            return res.status(200).json({
                message: "Payment Already Verified and Settled",
                status: "paid",
                settlementStatus: "completed",
                orderId: existingPayment.orderId,
                paymentId: existingPayment.paymentId,
                credits: existingPayment.credits,
                plan: existingPayment.plan
            });
        }

        // 6. If already marked paid but settlement is pending / failed / crashed:
        // SAFELY RESUME SETTLEMENT!
        if (existingPayment.status === "paid") {
            try {
                const settlementResult = await settlePaymentDirect(existingPayment);
                return res.status(200).json({
                    message: "Payment Verified and Settled",
                    status: "paid",
                    settlementStatus: settlementResult.payment?.settlementStatus || "completed",
                    orderId: existingPayment.orderId,
                    paymentId: existingPayment.paymentId,
                    credits: existingPayment.credits,
                    plan: existingPayment.plan
                });
            } catch (settleErr) {
                return res.status(500).json({
                    message: "Payment verified successfully, but credit settlement encountered an error. It will be retried automatically.",
                    status: "paid",
                    settlementStatus: "failed",
                    orderId: existingPayment.orderId,
                    error: settleErr.message
                });
            }
        }

        // 7. ATOMIC STATUS TRANSITION (created -> paid)
        // Transition payment status to "paid" and set settlementStatus to "pending"
        const updatedPayment = await Payment.findOneAndUpdate(
            {
                orderId: razorpay_order_id,
                status: "created"
            },
            {
                $set: {
                    status: "paid",
                    paymentId: razorpay_payment_id,
                    settlementStatus: "pending"
                }
            },
            { returnDocument: "after" }
        );

        let paymentToSettle = updatedPayment;

        if (!paymentToSettle) {
            const recheckPayment = await Payment.findOne({ orderId: razorpay_order_id });
            if (!recheckPayment || recheckPayment.status !== "paid") {
                return res.status(409).json({ message: "Payment status conflict: Order is not in created status" });
            }
            paymentToSettle = recheckPayment;
        }

        // 8. Execute settlement immediately
        try {
            const settlementResult = await settlePaymentDirect(paymentToSettle);
            return res.status(200).json({
                message: "Payment Verified and Settled",
                status: "paid",
                settlementStatus: settlementResult.payment?.settlementStatus || "completed",
                orderId: paymentToSettle.orderId,
                paymentId: razorpay_payment_id,
                credits: paymentToSettle.credits,
                plan: paymentToSettle.plan
            });
        } catch (settleError) {
            return res.status(500).json({
                message: "Payment verified successfully, but credit settlement encountered an error. Support has been notified.",
                status: "paid",
                settlementStatus: "failed",
                orderId: paymentToSettle.orderId,
                error: settleError.message
            });
        }

    } catch (error) {
        return res.status(500).json({ message: `verify payment error ${error.message || error}` });
    }
};

/**
 * 3. Recovery Mechanism for stuck payments
 * Scans for payments that are status: "paid" but settlementStatus: "pending", "failed", or stale "processing"
 */
export const recoverPendingSettlements = async ({ maxAgeMinutes = 2, limit = 50 } = {}) => {
    const staleThreshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    const stuckPayments = await Payment.find({
        status: "paid",
        $or: [
            { settlementStatus: { $in: ["pending", "failed"] } },
            {
                settlementStatus: "processing",
                lastSettlementAttemptAt: { $lt: staleThreshold }
            }
        ]
    }).limit(limit);

    const report = {
        totalFound: stuckPayments.length,
        settled: 0,
        alreadyCompleted: 0,
        failed: 0,
        errors: []
    };

    for (const payment of stuckPayments) {
        try {
            const result = await settlePaymentDirect(payment);
            if (result.alreadySettled) {
                report.alreadyCompleted++;
            } else if (result.success) {
                report.settled++;
            } else {
                report.failed++;
            }
        } catch (err) {
            report.failed++;
            report.errors.push({ orderId: payment.orderId, error: err.message });
        }
    }

    return report;
};

/**
 * HTTP Handler for Secure Recovery Endpoint
 * - Strictly validates and clamps input parameters (limit between 1 and 100, default 20)
 * - Returns sanitized aggregate metrics only (no sensitive order IDs or raw database errors)
 */
export const recoverSettlementsHandler = async (req, res) => {
    try {
        const body = req.body || {};

        // 1. Strict validation & clamping of limit (between 1 and 100, default 20)
        let limit = parseInt(body.limit, 10);
        if (isNaN(limit) || limit < 1) {
            limit = 20;
        } else if (limit > 100) {
            limit = 100;
        }

        // 2. Strict validation & clamping of maxAgeMinutes (between 0 and 10080 minutes / 7 days, default 2)
        let maxAgeMinutes = parseFloat(body.maxAgeMinutes);
        if (isNaN(maxAgeMinutes) || maxAgeMinutes < 0) {
            maxAgeMinutes = 2;
        } else if (maxAgeMinutes > 10080) {
            maxAgeMinutes = 10080;
        }

        const report = await recoverPendingSettlements({ maxAgeMinutes, limit });

        // 3. Sanitized response: returns aggregate counts only, never leaking other users' order IDs or internal errors
        return res.status(200).json({
            message: "Recovery scan completed successfully",
            report: {
                totalFound: report.totalFound,
                settled: report.settled,
                alreadyCompleted: report.alreadyCompleted,
                failed: report.failed
            }
        });
    } catch (error) {
        console.error("[Recovery Handler Error]:", error.message);
        return res.status(500).json({ message: "Settlement recovery execution failed" });
    }
};
