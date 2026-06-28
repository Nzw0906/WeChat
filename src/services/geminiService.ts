import { GoogleGenAI } from "@google/genai";
import { TarotCard } from "../data/tarotCards";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function interpretTarot(question: string, cards: { card: TarotCard; isReversed: boolean }[]) {
  const model = "gemini-3-flash-preview";
  
  const cardsInfo = cards.map(c => 
    `${c.card.name} (${c.isReversed ? "逆位" : "正位"}): ${c.isReversed ? c.card.reversedMeaning : c.card.meaning}`
  ).join("\n");

  const prompt = `
你是一位专业的塔罗占卜师。
用户的问题是: "${question}"
抽到的牌面如下:
${cardsInfo}

请根据这些牌面，为用户提供深度的解析。
解析应包括:
1. 牌面的综合意象。
2. 对问题的具体回答。
3. 给用户的建议。

请使用温暖、神秘且具有洞察力的语言，中文回复。
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("占卜解析失败，请稍后再试。");
  }
}
