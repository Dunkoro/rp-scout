import { GoogleGenerativeAI } from "@google/generative-ai";

export const analyzePostsWithGemini = async (posts, apiKey) => {
    if (!apiKey) throw new Error("No API key provided.");
    if (!posts || posts.length === 0) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Batching: Send only the first 600 characters of each post to save tokens
    const postSnippets = posts.map((p, index) => 
        `ID: ${index}\nTITLE: ${p.title}\nBODY: ${p.content.substring(0, 600)}...`
    ).join('\n---\n');

    const prompt = `
        You are a roleplay advertisement analyzer. Analyze the following ${posts.length} forum posts.
        Return a raw JSON array containing exactly ${posts.length} objects, in the same order as the IDs.
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
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Strip markdown formatting if Gemini includes it
        const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(cleanJsonString);

        return posts.map((post, index) => ({ ...post, ai: aiData[index] || {} }));
    } catch (error) {
        console.error("Gemini Error:", error);
        throw new Error("AI parsing failed. Check your API key.");
    }
};
