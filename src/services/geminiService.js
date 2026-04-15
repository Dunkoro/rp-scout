import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzePostsWithGemini = async (posts, apiKey, onChunkComplete) => {
    if (!apiKey || !posts?.length) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
        { model: "gemini-2.5-flash" }, 
        { apiVersion: "v1" } 
    );

    const CHUNK_SIZE = 4;
    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
        const chunk = posts.slice(i, i + CHUNK_SIZE);
        const postSnippets = chunk.map((p, idx) => 
            `ID: ${idx}\nTITLE: ${p.title}\nBODY: ${p.content?.substring(0, 500) || ''}`
        ).join('\n---\n');

        const prompt = `Analyze these ${chunk.length} RP ads. Return a RAW JSON array of objects. 
        Fields: "pairing", "platform", "type", "tags", "summary", "fandom" (Original, Fandom (OCs), Fandom (Canon), or Celebrity).
        Posts: ${postSnippets}`;

        try {
            if (i > 0) await new Promise(r => setTimeout(r, 4000));
            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(text);

            const analyzed = chunk.map((post, idx) => ({ ...post, ai: aiData[idx] || {} }));
            if (onChunkComplete) onChunkComplete(analyzed);
        } catch (error) {
            console.error("Gemini Error:", error);
            if (onChunkComplete) onChunkComplete(chunk.map(p => ({ ...p, ai: { summary: "Service busy." }})));
        }
    }
};
