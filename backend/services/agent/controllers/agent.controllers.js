import axios from "axios";
import { graph } from "../graph/graph.js";
import { addMessage } from "../config/memory.js";
import redis from "../../../shared/redis/redis.js";
import { saveMessageDirect } from "../../chat/controllers/chat.controller.js";
import { cleanupTempFile } from "../config/multer.js";

const persistMessage = async (payload) => {
    try {
        if (typeof saveMessageDirect === "function") {
            return await saveMessageDirect(payload);
        }
        if (process.env.CHAT_SERVICE) {
            const { data } = await axios.post(`${process.env.CHAT_SERVICE}/save-message`, payload);
            return data;
        }
    } catch (err) {
        console.error("persistMessage error:", err.message);
    }
};

export const agent = async (req, res, next) => {
    try {
        const { prompt, conversationId, agent } = req.body;
        const file = req.file;
        console.log("file", file);
        const userId = req.headers["x-user-id"];

        await persistMessage({
            conversationId,
            role: "user",
            content: prompt
        });

        const result = await graph.invoke({
            prompt,
            conversationId,
            agent,
            userId,
            file
        });

        console.log(result);

        await addMessage(conversationId, "user", prompt);
        await addMessage(conversationId, "assistant", result?.aiResponse || "");

        await persistMessage({
            conversationId,
            role: "assistant",
            content: result?.aiResponse,
            images: result?.images,
            artifacts: result?.artifacts
        });

        return res.status(200).json({
            answer: result?.aiResponse,
            images: result?.images,
            artifacts: result?.artifacts
        });

    } catch (error) {
        // Ensure temporary uploaded file is deleted if error occurs during processing
        if (req.file?.path) {
            cleanupTempFile(req.file.path);
        }
        next(error);
    }
};
