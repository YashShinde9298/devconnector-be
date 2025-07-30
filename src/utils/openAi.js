import { OpenAI } from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
})

const getOpenAIResponse = async (messages) => {
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages
    });
    return completion.choices[0]?.message?.content || "No response.";
};

export { openai, getOpenAIResponse }