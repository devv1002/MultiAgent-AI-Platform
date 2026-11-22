import express from "express"
import { createConversation, getConversations, getMessages, saveMessage, updateConversation } from "../controllers/chat.controller.js"

const router=express.Router()

// Public chat routes mounted for authenticated users
export const publicChatRouter = express.Router()
publicChatRouter.get("/create-conversation",createConversation)
publicChatRouter.get("/get-conversations",getConversations)
publicChatRouter.post("/update-conversation",updateConversation)
publicChatRouter.get("/get-messages/:conversationId",getMessages)

// Full router (includes internal endpoints for isolated service deployments)
router.get("/create-conversation",createConversation)
router.get("/get-conversations",getConversations)
router.post("/update-conversation",updateConversation)
router.post("/save-message",saveMessage)
router.get("/get-messages/:conversationId",getMessages)

export default router
