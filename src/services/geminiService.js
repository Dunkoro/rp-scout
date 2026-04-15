import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper function to slice the 25 posts into smaller groups
const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

export const analyzePostsWithGemini = async (posts, apiKey) => {
    if (!apiKey) throw new Error("No API key provided.");
    if (!posts || posts.length === 0) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Process exactly 5 posts at a time to prevent 503 Server Overload errors
    const CHUNK_SIZE = 5; 
    const chunks = chunkArray(posts, CHUNK_SIZE);
    let allAnalyzedPosts = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const postSnippets = chunk.map((p, index) => 
            `ID: ${index}\nTITLE: ${p.title}\nBODY: ${p.content.substring(0, 600)}...`
        ).join('\n---\n');

        const prompt = `
            You are a roleplay advertisement analyzer. Analyze the following ${chunk.length} forum posts.
            Return a raw JSON array containing exactly ${chunk.length} objects, in the same order as the IDs.
            Do not include markdown blocks like \`\`\`json.
            
            For each post, extract:
            1. "pairing": Genders/roles sought (e.g., "F4M", "A4A"). If unclear, output "Any".
            2. "platform": Where they want to play (e.g., "Discord", "Reddit").
            3. "type": "Looking for a story" or "Has a prompt".
            4. "tags": An array of 2-4 genre tags (e.g., ["Sci-Fi", "Romance"]).
            5. "summary": A brutal, 1-sentence summary of what the author wants.

            Posts to analyze:
            ${postSnippets}
        `;

        try {
            // Add a 1.5 second pause between chunks so Google doesn't think we are a spam bot
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(cleanJsonString);

            const analyzedChunk = chunk.map((post, index) => ({ ...post, ai: aiData[index] || {} }));
            allAnalyzedPosts = [...allAnalyzedPosts, ...analyzedChunk];

        } catch (error) {
            console.error(`Gemini Error on batch ${i + 1}:`, error);
            // Graceful degradation: If a batch fails, render the cards anyway but mark them as failed
            const failedChunk = chunk.map(post => ({ 
                ...post, 
                ai: { summary: "AI failed to read this post (Server Busy).", tags: [] }
            }));
            allAnalyzedPosts = [...allAnalyzedPosts, ...failedChunk];
        }
    }

    return allAnalyzedPosts;
};
