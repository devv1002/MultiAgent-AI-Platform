import dotenv from "dotenv"
dotenv.config()
import { ChatGroq } from "@langchain/groq"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOpenRouter } from "@langchain/openrouter";


const groq = new ChatGroq({
    model: "openai/gpt-oss-120b",
    timeout: 30000, // 30s timeout for fast LPU inference
    maxRetries: 2
})

const gemini = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    temperature: 0,
    timeout: 45000, // 45s timeout for multimodal image analysis
    maxRetries: 2
})

const openrouter = new ChatOpenRouter({
    model: "deepseek/deepseek-chat",
    temperature: 0.2,
    maxTokens: 8000,
    timeout: 85000, // 85s timeout preserves 15s safety buffer before Render's 100s proxy cutoff
    maxRetries: 0 // 0 retries strictly caps execution time to 85s max
})


export const getModel=async (agent)=>{
    switch (agent) {
        case "chat":
            return groq;
        case "search" :    
           return groq;
        case "coding": 
           return openrouter;  
        case "imageAnalyzer": 
           return gemini;
        case "intent":
            return groq;
    
        default:
            return groq;
    }
}
