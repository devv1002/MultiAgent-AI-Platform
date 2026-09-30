import { getModel } from "../config/llmModels.js"
import axios from "axios"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { getFromS3 } from "../utils/getFromS3.js"


export const visionAgent=async (state) => {

    try {
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

const prompt=res.content.trim()

console.log("IMAGE PROMPT LENGTH:", prompt.length)
console.log("IMAGE PROMPT:", prompt)

const imageUrl=`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`

const imageRes=await axios.get(imageUrl,{responseType:"arraybuffer"})
const buffer=Buffer.from(imageRes.data)
const filename=`image-${Date.now()}.png`

await uploadToS3(filename,buffer,"image/png")
const downloadUrl=await getFromS3(filename,24*60)

return {
    ...state,
    aiResponse:`
![Generated Image](${downloadUrl})

📥 [Download Image](${downloadUrl})

⏳ Link expires in 10 minutes.`
}
    } catch (error) {
       console.log(error)
         return {
            ...state,
            aiResponse:error?.data?.message || "failed to generate image"
        }
    }
   


}