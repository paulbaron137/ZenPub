import { GoogleGenAI } from "@google/genai";

// We check if the API key is available. If not, the UI should handle it gracefully.
const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateWritingSuggestion = async (
  prompt: string, 
  context: string,
  taskType: 'grammar' | 'expand' | 'summarize' | 'continue'
): Promise<string> => {
  if (!ai) {
    throw new Error("未找到 API 密钥。请确保 API Key 配置正确。");
  }

  const modelName = 'gemini-2.5-flash';
  
  let systemInstruction = "你是一位专业的图书编辑和写作助手。请使用流利的中文进行回复。";
  let fullPrompt = "";

  switch (taskType) {
    case 'grammar':
      systemInstruction += " 请修正所提供文本的语法、拼写和标点错误。仅返回修正后的文本，不要包含任何解释。";
      fullPrompt = `修正这段文本的语法：\n${context}`;
      break;
    case 'expand':
      systemInstruction += " 请扩写提供的文本，增加描述性的细节和深度，同时保持作者原有的风格。";
      fullPrompt = `扩写这段话：\n${context}`;
      break;
    case 'summarize':
      systemInstruction += " 请简要总结提供文本的核心内容。";
      fullPrompt = `总结这段内容：\n${context}`;
      break;
    case 'continue':
      systemInstruction += " 请根据提供的文本续写故事。续写长度大约 100-200 字。";
      fullPrompt = `续写这个故事：\n${context}`;
      break;
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config: {
        systemInstruction,
        maxOutputTokens: 1000,
      }
    });

    return response.text || "未能生成建议。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("生成建议失败，请重试。");
  }
};

export const performResearch = async (query: string): Promise<{ text: string, sources: {title: string, uri: string}[] }> => {
  if (!ai) throw new Error("未找到 API 密钥");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: `Search for this information and provide a concise summary in Chinese: ${query}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "未找到相关结果。";
    
    // Extract grounding sources
    const sources: {title: string, uri: string}[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri && chunk.web?.title) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri
          });
        }
      });
    }

    return { text, sources };
  } catch (error) {
    console.error("Search Error", error);
    throw new Error("搜索失败，请检查网络连接。");
  }
}
