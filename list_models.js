const fs = require('fs');

async function listModels() {
  try {
    const env = fs.readFileSync('.env.local', 'utf8');
    const match = env.match(/VITE_GEMINI_API_KEY=(.*)/);
    const key = match ? match[1].trim() : null;

    if (!key) {
      console.error("No API key found in .env.local");
      return;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    
    if (data.models) {
      const generateModels = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
      console.log("SUPPORTED MODELS FOR GENERATION:");
      generateModels.forEach(m => console.log(m.name));
    } else {
      console.log("Error fetching models:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Script error:", error);
  }
}

listModels();
