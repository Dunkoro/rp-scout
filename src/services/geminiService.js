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
    // 1.5-flash is the most stable "high capacity" free model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const CHUNK_SIZE = 3; 
    const chunks = chunkArray(posts, CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const postSnippets = chunk.map((p, index) => 
            `ID: ${index}\nTITLE: ${p.title}\nBODY: ${p.content.substring(0, 500)}...`
        ).join('\n---\n');

        const prompt = `Analyze these ${chunk.length} RP ads. Return a raw JSON array of objects.
        Fields: "pairing" (F4M, etc), "platform" (Discord, etc), "type" (Story/Prompt), 
        "tags" (2-4 genres), "summary" (1 sentence), 
        "fandom" (Original, Fandom (OCs), Fandom (Canon), or Celebrity).
        
        Posts:
        ${postSnippets}`;

        try {
            // Respectful 5-second delay to avoid 503 errors
            if (i > 0) await new Promise(r => setTimeout(r, 5000));
            
            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(text);

            const analyzed = chunk.map((post, idx) => ({ ...post, ai: aiData[idx] || {} }));
            if (onChunkComplete) onChunkComplete(analyzed);

        } catch (error) {
            console.error("Gemini Batch Error:", error);
            if (onChunkComplete) onChunkComplete(chunk.map(p => ({ ...p, ai: { summary: "AI Busy. Try refreshing.", tags: [] }})));
        }
    }
};
