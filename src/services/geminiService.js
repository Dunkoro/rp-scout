import { GoogleGenerativeAI } from "@google/generative-ai";

const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

export const analyzePostsWithGemini = async (posts, apiKey, onChunkComplete) => {
    if (!apiKey || !posts.length) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const CHUNK_SIZE = 3; 
    const chunks = chunkArray(posts, CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // We now include "NATIVE_TAGS" in the snippet so the AI sees the flair/brackets
        const postSnippets = chunk.map((p, index) => 
            `ID: ${index}\nTITLE: ${p.title}\nNATIVE_TAGS: ${p.nativeTags?.join(', ')}\nBODY: ${p.content.substring(0, 500)}...`
        ).join('\n---\n');

        const prompt = `Analyze these ${chunk.length} RP ads. Use the TITLE and NATIVE_TAGS to help categorize.
        Return a raw JSON array of objects.
        Fields: "pairing", "platform", "type" (Story/Prompt), "tags" (2-4 genres), "summary" (1 sentence), 
        "fandom" (Original, Fandom (OCs), Fandom (Canon), or Celebrity).
        
        Posts:
        ${postSnippets}`;

        try {
            if (i > 0) await new Promise(r => setTimeout(r, 5000));
            
            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(text);

            const analyzed = chunk.map((post, idx) => ({ ...post, ai: aiData[idx] || {} }));
            if (onChunkComplete) onChunkComplete(analyzed);

        } catch (error) {
            console.error("Gemini Error:", error);
            if (onChunkComplete) onChunkComplete(chunk.map(p => ({ ...p, ai: { summary: "AI Busy. Try refreshing.", tags: [] }})));
        }
    }
};
