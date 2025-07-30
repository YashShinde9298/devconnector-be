import axios from 'axios';

const openRouter = axios.create({
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
    }
})

const getOpenRouterResponse = async (messages, model = "google/gemma-3-27b-it:free") => {
    const response = await openRouter.post('/chat/completions', {
        model,
        messages
    })
    return response.data.choices[0].message.content;
}

export { openRouter, getOpenRouterResponse };
