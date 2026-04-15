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
    // 1.5-flash has much higher quotas for free keys than 2.5
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Processing 5 at a time to stay well under the daily request limit
    const CHUNK_SIZE = 5; 
    const chunks = chunkArray(posts, CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const postSnippets = chunk.map((p, index) => 
            `ID: ${index}\nTITLE: ${p.title}\nBODY: ${p.content.substring(0, 500)}...`
        ).join('\n---\n');

        const prompt = `Analyze these ${chunk.length} RP ads. 
        Return a RAW JSON array of objects. Fields: "pairing", "platform", "type", "tags", "summary", "fandom" (Original, Fandom (OCs), Fandom (Canon), or Celebrity).
        Posts:
        ${postSnippets}`;

        try {
            // Keep a 4-second delay just to be safe with the minute-rate-limit
            if (i > 0) await new Promise(r => setTimeout(r, 4000));
            
            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(text);

            const analyzed = chunk.map((post, idx) => ({ ...post, ai: aiData[idx] || {} }));
            if (onChunkComplete) onChunkComplete(analyzed);

        } catch (error) {
            console.error("Gemini Error:", error);
            // If we hit a 429, wait 10 seconds and try to continue the loop
            if (error.message.includes('429')) {
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }
};
