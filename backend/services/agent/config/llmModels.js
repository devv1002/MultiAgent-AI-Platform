import dotenv from "dotenv"
dotenv.config()
import { ChatGroq } from "@langchain/groq"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOpenRouter } from "@langchain/openrouter";


const groq=new ChatGroq({
    model:"openai/gpt-oss-120b"
})

const gemini = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    temperature: 0
})

const openrouter = new ChatOpenRouter({
    model: "deepseek/deepseek-chat",
    temperature: 0.2,
    maxTokens: 8000,
    timeout: 120000,   // long generations need more time
    maxRetries: 1
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
