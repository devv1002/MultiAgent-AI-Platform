import axios from "axios";
import { getMessagesDirect } from "../../chat/controllers/chat.controller.js";

export const getMessages = async (conversationId) => {
    try {
        if (typeof getMessagesDirect === "function") {
            return await getMessagesDirect(conversationId);
        }
        if (process.env.CHAT_SERVICE) {
            const { data } = await axios.get(`${process.env.CHAT_SERVICE}/get-messages/${conversationId}`);
            return data;
        }
        return null;
    } catch (error) {
        console.error("getMessages error:", error.message);
        return null;
    }
};
