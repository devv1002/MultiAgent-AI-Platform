import { getModel } from "../config/llmModels.js"

export const codingAgent = async (state) => {
    const intentLlm=await getModel("intent")
    const llm=await getModel("coding")
    const intentRes=await intentLlm.invoke(`
    You are an intent classifier.

Return ONLY one of these values.

CODE_GENERATION
CODE_REVIEW
CODE_EXPLANATION
DEBUGGING
OPTIMIZATION
CONVERSION
DOCUMENTATION

User Request:
${state.prompt}
    `)
    const intent=intentRes.content
    if(intent=="CODE_GENERATION"){
        const prompt=`
        You are CortexAI Coding Agent.

      
Generate the requested project.

Default stack:
- HTML
- CSS
- JavaScript

Use React / Next.js / Vue ONLY if explicitly requested.

Rules:

- Responsive
- Modern UI
- CSS Variables
- Flexbox/Grid
- Smooth Scroll
- Hover Effects
- Beautiful spacing
- Single page unless user asks otherwise.


IMAGES
=========================

Image URLs are extremely important because the generated website
will be rendered inside an iframe.

Follow these rules strictly:

1. NEVER use source.unsplash.com.
2. NEVER use https://source.unsplash.com/random/...
3. NEVER use deprecated Unsplash Source URLs.
4. NEVER use unsplash.com/photos/... as an image src.
5. NEVER use Google Images URLs.
6. NEVER use fake, invented, example, or placeholder URLs.
7. Every <img src=""> must contain a complete HTTPS direct image URL.
8. Prefer direct images from images.unsplash.com.
9. Use stable direct image URLs instead of dynamic/random image endpoints.
10. Always provide a meaningful alt attribute.
11. If multiple images are required, use different valid direct image URLs.
12. Do not use JavaScript to dynamically construct image URLs.

Example of a VALID image:

<img
  src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80"
  alt="Delicious food"
/>

Example of an INVALID image:

<img
  src="https://source.unsplash.com/random/400x300?food"
  alt="Food"
/>

IMPORTANT:

Do not invent an Unsplash URL just because it looks valid.

If you cannot provide a reliable direct image URL for a particular image,
use a CSS-based visual placeholder instead of generating a broken
external URL.

Before returning the final JSON, inspect every generated <img> element
and ensure that:

- src starts with https://
- src does NOT contain source.unsplash.com
- src is a direct image URL
- alt is present

OUTPUT FORMAT
=========================

Return ONLY valid JSON.

Schema:

{
  "files":[
    {
      "name":"index.html",
      "content":"..."
    },
    {
      "name":"style.css",
      "content":"..."
    },
    {
      "name":"script.js",
      "content":"..."
    }
  ]
}

Rules:

- Output must start with {
- Output must end with }
- No markdown
- No explanation
- No extra text
- No \`\`\`
- Never mention intent

User Request:
${state.prompt}
`
        const res=await llm.invoke(prompt)
        console.log(res)
        const data=JSON.parse(res.content)

        return {
            ...state,
            aiResponse:"Code Generated Successfully.",
            artifacts:[
                {
                    id:Date.now(),
                    type:"Project",
                    files:data.files || [],
                    title:state.prompt
                }
            ]
        }
    }
    const res=await llm.invoke(`
    The user's request is:

${intent}

Return Markdown only.

Never generate project files.

Use headings like:

# Overview

## Explanation

## Problems

## Improvements

## Best Practices

## Optimized Code (if needed)

User Request:

${state.prompt}
        `)
    const data=res.content 
    
    return {
        ...state,
        aiResponse:data,
        artifacts:[]
       }  

}