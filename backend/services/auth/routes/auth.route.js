import express from "express"
import { deductCredits, login, logOut, updateUserPayment } from "../controllers/auth.controller.js"

const router = express.Router()

// Public auth routes (mounted by gateway / consolidated app)
export const publicAuthRouter = express.Router()
publicAuthRouter.post("/login", login)
publicAuthRouter.get("/logout", logOut)

// Full router (includes internal endpoints for backward-compatibility in isolated service deployments)
router.post("/login", login)
router.get("/logout", logOut)
router.post("/update-plan",updateUserPayment)
router.post("/deduct-credits",deductCredits)

export default router
