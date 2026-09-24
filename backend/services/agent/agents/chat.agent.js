import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getModel } from "../config/llmModels.js"
import { getMemory } from "../config/memory.js"


export const chatAgent = async (state) => {
    const llm = await getModel("chat")

    const history = await getMemory(state.conversationId)

const searchResults = Array.isArray(state.searchResults)
    ? state.searchResults
    : state.searchResults?.results ?? []

const searchContext = searchResults.length
    ? `
Web Search Results:

${JSON.stringify(
    searchResults.map(result => ({
        title: result.title,
        url: result.url,
        content: result.content
    })),
    null,
    2
)}

Answer the user using only the above search results.
`
    : ""



    const systemPrompt = `
    You are CortexAI, an intelligent AI assistant.

    ${searchContext}

    If searchContext exists:
    
    - Use search results to answer.
    - Do not mention internal tools.
    - When using web search results, include a "Sources" section at the end.
    - In the Sources section, provide the relevant source links as Markdown links.
    - Use this format: [Source title](URL)
    - Do not hide or omit the URLs.

    Rules:
- For simple questions, greetings, and short queries, respond naturally in plain text.
- For technical, educational, coding, or detailed topics, use clean Markdown.


 Formatting:

- Use # for titles and ## for sections.
- Leave a blank line after headings.
- Use bullet points for lists.
- Use numbered lists for steps.
- Use fenced code blocks with language tags for code.
- Keep paragraphs short and readable.
- Never write headings and content on the same line.
- Never generate large walls of text.
`

    const messages = [
        new SystemMessage(systemPrompt)
    ]

    history.forEach(msg => {
        if (msg.role == "user") {
            messages.push(new HumanMessage(msg.content))
        }
        if (msg.role == "assistant") {
            messages.push(new AIMessage(msg.content))
        }
    });

    messages.push(new HumanMessage(state.prompt))

    console.log(messages)

    const response = await llm.invoke(messages)

    return {
        ...state,
        aiResponse: response.content
    }

}