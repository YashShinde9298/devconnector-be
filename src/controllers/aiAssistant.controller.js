import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { Profile } from '../models/Profile.model.js';
import { getOpenRouterResponse } from '../utils/openRouter.js';

const chatWithAssistant = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { prompt } = req.body;

    if (!prompt) {
        throw new ApiError(400, "Promt is required")
    }

    const profile = await Profile.findOne({ user: userId });
    const systemPrompt = `You are a career assistant AI helping users grow professionally and improve their profile. Provide concise and helpful responses.`;
    let messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
    ];

    if (/\b(profile|improve|bio|summary|skills|education|project)\b/i.test(prompt)) {
        messages.splice(1, 0, {
            role: "system",
            content: `Here is the user's profile: ${JSON.stringify(profile)}`
        });
    }

    const reply = await getOpenRouterResponse(messages);
    return res
        .status(200)
        .json(new ApiResponse(200, { reply }, "Response generated", true))

})

const improveProfile = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { promptType, customPrompt } = req.body;
    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
        throw new ApiError(404, "User profile not found");
    }

    let promptMessage = "";

    switch (promptType) {
        case "analyze":
            promptMessage = `Analyze this profile and suggest improvements: ${JSON.stringify(profile)}`;
            break;
        case "bio":
            promptMessage = `Rewrite or improve the bio/summary for this profile: ${JSON.stringify(profile)}`;
            break;
        case "roadmap":
            promptMessage = `Based on this profile, suggest a skill roadmap for career growth: ${JSON.stringify(profile)}`;
            break;
        case "custom":
            promptMessage = `${customPrompt}\nProfile data: ${JSON.stringify(profile)}`;
            break;
        default:
            throw new ApiError(400, "Invalid prompt type");
    }

    const messages = [
        {
            role: "system",
            content: "You are a professional profile improvement assistant. Analyze the user's profile and suggest improvements, missing fields, or better summaries."
        },
        {
            role: "user",
            content: promptMessage
        }
    ];

    const reply = await getOpenRouterResponse(messages);
    return res
        .status(200)
        .json(new ApiResponse(200, { reply }, "Profile improvement suggestions generated", true))
})

const suggestLearningTopics = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { count = 5 } = req.body;

    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
        throw new ApiError(404, "User profile not found");
    }

    const userSkills = profile.skills || [];
    const experience = profile.experience || [];
    const education = profile.education || [];

    const promptMessage = `Based on this developer's profile, suggest ${count} relevant learning topics/technologies they should explore next:
            Current Skills: ${userSkills.join(', ')}
            Experience: ${experience.map(exp => `${exp.title} at ${exp.company}`).join(', ')}
            Education: ${education.map(edu => `${edu.degree} in ${edu.fieldOfStudy}`).join(', ')}

            Please provide suggestions in this JSON format:
                {
                    "suggestions": [
                        {
                            "topic": "Topic Name",
                            "reason": "Why this is relevant",
                            "difficulty": "Beginner/Intermediate/Advanced",
                            "category": "Frontend/Backend/DevOps/Mobile/etc",
                            "resources" : [
                                {
                                    "name" : "Resource Name",
                                    "url" : "https://example.com"
                                }
                            ]   
                        }
                    ]
            }`;

    const messages = [
        {
            role: "system",
            content: "You are a career development AI that suggests relevant learning topics for developers. Always respond with valid JSON format."
        },
        {
            role: "user",
            content: promptMessage
        }
    ]

    const reply = await getOpenRouterResponse(messages);

    const cleanedReply = reply
        .replace(/```json/g, '')
        .replace(/```/g, '')
    try {
        const suggestions = JSON.parse(cleanedReply);
        return res
            .status(200)
            .json(new ApiResponse(200, suggestions, "Learning suggestions generated successfully", true));
    } catch (error) {
        return res
            .status(200)
            .json(new ApiResponse(200, { reply }, "Learning suggestions generated", true));
    }
})

export { chatWithAssistant, improveProfile, suggestLearningTopics };