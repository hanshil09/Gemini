console.log("Starting Gemini Backend...");

const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const BASE_SYSTEM_PROMPT = `
You are a professional AI fitness and nutrition coach. Your role is to provide accurate and helpful advice related to:
- Exercise & workouts
- Weight loss, gain, or maintenance
- Healthy eating and diets
- Nutritional plans and calorie intake
- Fitness habits, beginner tips, and meal planning

Do not answer questions unrelated to fitness, health, food, or exercise. If a question is outside this scope, respond politely: "I'm sorry, I only focus on fitness and nutrition. How can I assist you with your health goals?"
`;

const sessions = {};

app.post('/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;

  if (!message && sessions[sessionId]) {
    return res.status(400).json({ error: 'Message is required for ongoing sessions' });
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = { history: [] };
    const initialPrompt = `
      ${BASE_SYSTEM_PROMPT}

      Greet a random user warmly as a professional fitness coach and ask a question to start the conversation, such as inquiring about their fitness goals, current exercise routine, or dietary preferences.
    `;
    try {
      console.log("Sending initial prompt to Gemini:", initialPrompt);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{ role: "user", parts: [{ text: initialPrompt }] }],
          systemInstruction: { parts: [{ text: BASE_SYSTEM_PROMPT }] }
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const reply = response.data.candidates[0].content.parts[0].text || "No response from Gemini.";
      sessions[sessionId].history.push({ role: "user", parts: [{ text: initialPrompt }] });
      sessions[sessionId].history.push({ role: "model", parts: [{ text: reply }] });
      return res.json({ reply });
    } catch (error) {
      console.error("Error from Gemini API (initial):", error.response?.data || error.message);
      return res.status(500).json({ error: "Failed to get response from Gemini." });
    }
  }

  const prompt = `${BASE_SYSTEM_PROMPT}\n\nUser message: ${message}`;

  // Validate and filter history to ensure correct roles
  const validHistory = sessions[sessionId].history.filter(
    msg => msg.role === "user" || msg.role === "model"
  );

  // Ensure alternating roles by removing consecutive user or model roles
  const cleanedHistory = [];
  let lastRole = null;
  for (const msg of validHistory) {
    if (msg.role !== lastRole) {
      cleanedHistory.push(msg);
      lastRole = msg.role;
    }
  }

  try {
    console.log("Sending chat prompt to Gemini:", prompt);
    console.log("Chat history:", JSON.stringify(cleanedHistory, null, 2));
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          ...cleanedHistory,
          { role: "user", parts: [{ text: prompt }] }
        ],
        systemInstruction: { parts: [{ text: BASE_SYSTEM_PROMPT }] }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = response.data.candidates[0].content.parts[0].text || "No response from Gemini.";
    sessions[sessionId].history.push({ role: "user", parts: [{ text: prompt }] });
    sessions[sessionId].history.push({ role: "model", parts: [{ text: reply }] });
    res.json({ reply });
  } catch (error) {
    console.error("Error from Gemini API (chat):", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to get response from Gemini." });
  }
});

app.listen(port, () => {
  console.log(`Gemini backend server running on port ${port}`);
});