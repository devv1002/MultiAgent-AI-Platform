import crypto from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { app } from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../shared/redis/redis.js";

export const login = async (req, res) => {
    try {
        const { token } = req.body;

        const decoded = await getAuth(app).verifyIdToken(token);

        let user = await User.findOne({
            firebaseUid: decoded.uid
        });

        if (!user) {
            user = await User.create({
                firebaseUid: decoded.uid,
                name: decoded.name,
                email: decoded.email,
                avatar: decoded.picture
            });
        }

        const sessionId = crypto.randomUUID();

        await redis.set(`user-session-${user?._id}`,
            sessionId
            ,"EX", 7 * 24 * 60 * 60)

        await redis.set(`session-${sessionId}`,JSON.stringify({
            userId:user._id,
            name:user.name,
            email:user.email,
            avatar:user.avatar,
            plan: user.plan,
            credits: user.credits,
            totalCredits: user.totalCredits,
            planExpiresAt: user.planExpiresAt
        }),"EX",7 * 24 * 60 * 60)

        res.cookie("session", sessionId, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json(user);

    }catch (error) {
        console.error("LOGIN ERROR:", error);
    
        return res.status(500).json({
            message: error.message,
            stack: error.stack
        });
    }
}

export const logOut = async (req, res) => {
    try {
        const sessionId = req.cookies?.session;
        if (sessionId) {
            try {
                const sessionData = await redis.get(`session-${sessionId}`);
                if (sessionData) {
                    const parsed = JSON.parse(sessionData);
                    if (parsed?.userId) {
                        await redis.del(`user-session-${parsed.userId}`);
                    }
                }
            } catch {
                // Ignore session parsing errors during logout
            }
            await redis.del(`session-${sessionId}`);
        }

        res.clearCookie("session", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/"
        });
        return res.status(200).json({ message: "Logout successfully" });
    } catch (error) {
        return res.status(500).json({ message: `logout error ${error.message || error}` });
    }
}


// Direct internal service function for updating user plan
export const updateUserPaymentDirect = async ({ plan, credits, userId, orderId }) => {
    // If orderId is provided, enforce atomic idempotency via settledOrders
    if (orderId) {
        const updatedUser = await User.findOneAndUpdate(
            {
                _id: userId,
                settledOrders: { $ne: orderId }
            },
            {
                $inc: { credits: Number(credits), totalCredits: Number(credits) },
                $set: {
                    plan: plan,
                    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                },
                $addToSet: { settledOrders: orderId }
            },
            { returnDocument: "after" }
        );

        if (!updatedUser) {
            const existingUser = await User.findById(userId);
            if (!existingUser) {
                throw new Error("User not found");
            }
            if (existingUser.settledOrders && existingUser.settledOrders.includes(orderId)) {
                // Order was already settled for this user: idempotent success without duplicate crediting
                return { success: true, alreadySettled: true, credits: existingUser.credits };
            }
            throw new Error("Failed to update user payment: conditional update failed");
        }

        try {
            const sessionId = await redis.get(`user-session-${updatedUser._id}`);
            if (sessionId) {
                await redis.set(`session-${sessionId}`, JSON.stringify({
                    userId: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    avatar: updatedUser.avatar,
                    plan: updatedUser.plan,
                    credits: updatedUser.credits,
                    totalCredits: updatedUser.totalCredits,
                    planExpiresAt: updatedUser.planExpiresAt
                }), "EX", 7 * 24 * 60 * 60);
            }
        } catch (redisErr) {
            console.warn("[Redis Session Sync Notice] Session key update skipped:", redisErr.message);
        }

        return { success: true, alreadySettled: false, credits: updatedUser.credits };
    }

    // Legacy fallback when orderId is not provided
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }
    user.plan = plan;
    user.credits += Number(credits);
    user.totalCredits += Number(credits);
    user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    try {
        const sessionId = await redis.get(`user-session-${user?._id}`);
        if (sessionId) {
            await redis.set(`session-${sessionId}`, JSON.stringify({
                userId: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                plan: user.plan,
                credits: user.credits,
                totalCredits: user.totalCredits,
                planExpiresAt: user.planExpiresAt
            }), "EX", 7 * 24 * 60 * 60);
        }
    } catch (redisErr) {
        console.warn("[Redis Session Sync Notice] Session key update skipped:", redisErr.message);
    }

    return { success: true, credits: user.credits };
};

export const updateUserPayment = async (req, res) => {
    try {
        const { plan, credits, userId } = req.body
        const result = await updateUserPaymentDirect({ plan, credits, userId })
        return res.status(200).json(result)
    } catch (error) {
        return res.status(500).json({ message: `update user payment error ${error}` })
    }
}

// Direct internal service function for deducting user credits
export const deductCreditsDirect = async (userId, agent) => {
    const COST = {
        chat: 1,
        search: 5,
        coding: 10,
        pdf: 10,
        ppt: 10,
        vision: 10
    };

    const user = await User.findById(userId)
    if (!user) {
        throw new Error("user not found")
    }

    const requiredCredits = COST[agent] || 1
    if (user.credits < requiredCredits) {
        const err = new Error("Not enough credits.")
        err.statusCode = 400
        throw err
    }
    user.credits -= requiredCredits
    await user.save()

    try {
        const sessionId = await redis.get(`user-session-${user?._id}`)
        if (sessionId) {
            await redis.set(`session-${sessionId}`, JSON.stringify({
                userId: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                plan: user.plan,
                credits: user.credits,
                totalCredits: user.totalCredits,
                planExpiresAt: user.planExpiresAt
            }), "EX", 7 * 24 * 60 * 60)
        }
    } catch (redisErr) {
        console.warn("[Redis Session Sync Notice] Session key update skipped:", redisErr.message)
    }

    return { success: true, credits: user.credits }
}

export const deductCredits = async (req, res) => {
    try {
        const { userId, agent } = req.body
        const result = await deductCreditsDirect(userId, agent)
        return res.status(200).json(result)
    } catch (error) {
        const status = error.statusCode || 500
        return res.status(status).json({ message: error.message || `deduct credits error ${error}` })
    }
}