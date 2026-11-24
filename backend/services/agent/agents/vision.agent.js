import crypto from "crypto"
import { getModel } from "../config/llmModels.js"
import axios from "axios"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { deductCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"

const MIME_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif"
};

export const sanitizePrompt = (rawPrompt) => {
    if (!rawPrompt) return "";
    return String(rawPrompt)
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .trim()
        .slice(0, 300)
        .trim();
};

const extractErrorMessage = (error) => {
    if (error.code === "ECONNABORTED" || error.message?.toLowerCase().includes("timeout")) {
        return "Image generation timed out after 45 seconds. Please try again.";
    }

    if (error.response) {
        const status = error.response.status;
        let providerDetail = "";

        if (error.response.data) {
            try {
                let dataStr = "";
                if (Buffer.isBuffer(error.response.data)) {
                    dataStr = error.response.data.toString("utf8");
                } else if (typeof error.response.data === "string") {
                    dataStr = error.response.data;
                } else {
                    dataStr = JSON.stringify(error.response.data);
                }
                const parsed = JSON.parse(dataStr);
                providerDetail = parsed.error?.message || parsed.message || parsed.error || "";
            } catch {
                if (typeof error.response.data === "string") {
                    providerDetail = error.response.data.slice(0, 200);
                }
            }
        }

        switch (status) {
            case 401:
                return "Authentication failed: Invalid or missing Pollinations API key.";
            case 402:
                return "Payment required: Insufficient pollen or Quest balance to generate image.";
            case 429:
                return "Rate limit exceeded: Too many requests sent to image generation service. Please try again later.";
            default:
                return providerDetail
                    ? `Image generation provider error (${status}): ${providerDetail}`
                    : `Image generation provider error (${status}). Please try again.`;
        }
    }

    if (error.message?.includes("Invalid image content type")) {
        return error.message;
    }

    if (error.message?.includes("Storage Upload Error") || error.message?.includes("storage") || error.message?.includes("Supabase")) {
        return "Image storage failed: Unable to save generated image to storage.";
    }

    return error?.message || "failed to generate image";
};

export const visionAgent=async (state) => {

    try {
        await checkAgentLimit(state.userId,"image")
         const llm=await getModel("image")
    const res = await llm.invoke(`
You are an AI image prompt engineer.

Convert the user's request into a concise but detailed image-generation prompt.

Requirements:
- Photorealistic
- Cinematic lighting
- Professional composition
- High detail
- Sharp focus
- Natural colors
- Depth of field

Keep the final prompt under 500 characters.

Return only the image prompt.

User Request:
${state.prompt}
`)

const prompt = sanitizePrompt(res.content);

console.log("IMAGE PROMPT LENGTH:", prompt.length)

const apiKey = process.env.POLLINATIONS_API_KEY?.trim();
if (!apiKey) {
    throw new Error("Pollinations API key is not configured");
}

const headers = {
    Authorization: `Bearer ${apiKey}`
};

// Verified Quest-compatible model: black-forest-labs/flux.1-schnell (alias: flux)
const chosenModel = "flux";
const imageUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(chosenModel)}`;

const imageRes = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 45000,
    headers
})

const rawContentType = imageRes.headers?.["content-type"] || "";
const contentType = rawContentType.split(";")[0].trim().toLowerCase();
const extension = MIME_TO_EXT[contentType];

if (!extension) {
    throw new Error(`Invalid image content type received: ${contentType || "none"}. Expected a valid image format.`);
}

const buffer = Buffer.from(imageRes.data)
const filename = `image-${crypto.randomUUID()}.${extension}`

await uploadToS3(filename, buffer, contentType)
const downloadUrl = await getFromS3(filename, 15 * 60)

// Deduct CortexAI user credits only after successful generation, upload, and signed URL generation
await deductCredits(state.userId, "vision")

return {
    ...state,
    aiResponse:`
![Generated Image](${downloadUrl})

📥 [Download Image](${downloadUrl})

⏳ Link expires in 15 minutes.`
}
    } catch (error) {
       console.error("visionAgent error:", error?.message || "failed to generate image");
         return {
            ...state,
            aiResponse: extractErrorMessage(error)
        }
    }
}
