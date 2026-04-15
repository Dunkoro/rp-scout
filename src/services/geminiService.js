import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzePostsWithGemini = async (posts, apiKey, onChunkComplete) => {
    if (!apiKey || !posts || posts.length === 0) return [];

    // Force the stable version to avoid 404s
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

    const CHUNK_SIZE = 4;
    const chunks = [];
    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
        chunks.push(posts.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const postSnippets = chunk.map((p, index) => 
            `ID: ${index}\nTITLE: ${p.title}\nBODY: ${p.content?.substring(0, 500) || ''}`
        ).join('\n---\n');

        const prompt = `Analyze these ${chunk.length} RP ads. Return a RAW JSON array of objects. 
        Fields: "pairing", "platform", "type", "tags", "summary", "fandom" (Original, Fandom (OCs), Fandom (Canon), or Celebrity).
        Posts: ${postSnippets}`;

        try {
            // Respectful delay for the Free Tier
            if (i > 0) await new Promise(r => setTimeout(r, 5000));
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(text);

            const analyzed = chunk.map((post, idx) => ({ ...post, ai: aiData[idx] || {} }));
            if (onChunkComplete) onChunkComplete(analyzed);
        } catch (error) {
            console.error("Gemini Error:", error);
            if (onChunkComplete) onChunkComplete(chunk.map(p => ({ ...p, ai: { summary: "Service Busy." }})));
        }
    }
};
