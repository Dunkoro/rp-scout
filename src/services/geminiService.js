import { GoogleGenerativeAI } from "@google/generative-ai";

const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

// Notice the new third parameter: onChunkComplete
export const analyzePostsWithGemini = async (posts, apiKey, onChunkComplete) => {
    if (!apiKey) throw new Error("No API key provided.");
    if (!posts || posts.length === 0) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const CHUNK_SIZE = 5; 
    const chunks = chunkArray(posts, CHUNK_SIZE);

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
            4. "tags": An array of 4+ genre tags (e.g., ["Sci-Fi", "Romance", "NSFW", "Political"]).
            5. "fandom": Output EXACTLY one of these three options: "Original" (totally original world and characters), "Fandom (OCs)" (set in an existing franchise world, but playing Original Characters), or "Fandom (Canon)" (playing as established franchise characters). Do not output specific franchise names.
            6. "summary": A brutal, 1-sentence summary of what the author wants.

            Posts to analyze:
            ${postSnippets}
        `;

        try {
            // Google Free Tier Limit: 15 Requests Per Minute. 
            // We must wait 4 seconds between batches to avoid the 503 error.
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 4000));
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(cleanJsonString);

            const analyzedChunk = chunk.map((post, index) => ({ ...post, ai: aiData[index] || {} }));
            
            // FIRE THE DATA TO THE UI IMMEDIATELY
            if (onChunkComplete) onChunkComplete(analyzedChunk);

        } catch (error) {
            console.error(`Gemini Error on batch ${i + 1}:`, error);
            const failedChunk = chunk.map(post => ({ 
                ...post, 
                ai: { summary: "AI failed to read this post (Server Busy).", tags: [] }
            }));
            
            // IF IT FAILS, STILL FIRE THE RAW POSTS TO THE UI
            if (onChunkComplete) onChunkComplete(failedChunk);
        }
    }
};
