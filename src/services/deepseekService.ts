import { TarotCard } from "../data/tarotCards";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export async function interpretTarot(question: string, cards: { card: TarotCard; isReversed: boolean }[]) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DeepSeek API key is not configured");
  }

  const cardsInfo = cards.map(c => 
    `${c.card.name} (${c.isReversed ? "逆位" : "正位"}): ${c.isReversed ? c.card.reversedMeaning : c.card.meaning}`
  ).join("\n");

  const prompt = `
你是一位专业的塔罗占卜师。
用户的问题是: "${question}"
抽到的牌面如下:
${cardsInfo}

请根据这些牌面，为用户提供深度的解析。

【重要格式要求】
请严格按照以下格式组织回复，使用清晰的标题层级：

# 塔罗牌阵解读
## 一、牌面的综合意象
（详细描述牌面传达的整体信息）

## 二、问题具体分析
（针对用户问题进行详细解答）

## 三、建议与启示
（给用户的具体建议和指导）

或者，你也可以使用 "1. xxx", "2. xxx" 这样的编号格式。
每个段落单独一行，段落之间用空行分隔。
重要的是要有清晰的标题和层级。

【文本样式要求】
- 重要的关键词和短语使用 **粗体** 表示（用 **包裹**）
- 例如：这是一个 **重要的提示**，请特别注意
- 不要使用单个 * 号，只使用 **表示加粗**

请使用温暖、神秘且具有洞察力的语言，中文回复。
`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是一位专业的塔罗占卜师，擅长解读塔罗牌的神秘智慧。"
          },
          {
            role: "user",
            content: prompt.trim()
          }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("DeepSeek Error:", error);
    throw new Error("占卜解析失败，请稍后再试。");
  }
}