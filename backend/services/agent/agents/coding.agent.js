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

Images must work correctly in the browser preview.

Follow these rules strictly:

1. NEVER use source.unsplash.com.
2. NEVER use source.unsplash.com/random.
3. NEVER use deprecated Unsplash Source URLs.
4. NEVER use unsplash.com/photos URLs as image sources.
5. NEVER use Google Images URLs.
6. NEVER use fake or invented image URLs.
7. Every image URL must be a complete HTTPS URL.
8. The URL must directly point to an image resource.
9. Prefer images from images.unsplash.com.
10. Always include a meaningful alt attribute.
11. Do not use markdown links for image URLs.
12. Do not wrap image URLs in markdown syntax.
13. Do not use JavaScript to construct image URLs.
14. Do not use random image endpoints.
15. If you cannot provide a reliable image URL, use a CSS-based visual instead of a broken image.

VALID:

<img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80" alt="Delicious pizza">

INVALID:

<img src="https://source.unsplash.com/random/400x300?food" alt="Food">

INVALID:

<img src="[https://source.unsplash.com/400x300/?pizza](https://source.unsplash.com/400x300/?pizza)" alt="Pizza">

IMPORTANT:

Never output markdown inside HTML.

The src attribute must contain ONLY the raw HTTPS image URL.

Before returning the JSON, inspect every img element and every CSS background-image.

Make sure:
- The URL starts with https://
- The URL does not contain source.unsplash.com
- The URL is not a markdown link
- The URL is directly usable by an img or CSS background
- The image has an alt attribute

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