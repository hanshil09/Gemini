console.log("Starting Gemini Backend...");

const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const SYSTEM_PROMPT = `
You are a professional AI fitness coach who interacts like a human personal trainer.

Your role:
- Greet the user warmly.
- Start by explaining you will customize their fitness plan.
- Then **ask the following questions one by one** and wait for user input after each:

1. What is your name?
2. What is your gender? (Male/Female/Other)
3. What is your age in years?
4. What is your height in centimeters?
5. What is your weight in kilograms?

After collecting all the data:
- Calculate BMI.
- Explain what their BMI means.
- Give a recommendation: maintain, lose, or gain weight based on BMI & gender.
- Suggest:
    a) Daily calorie intake for maintenance
    b) Calorie deficit plan for safe weight loss (500 kcal less)
    c) Calorie surplus plan for safe weight gain (500 kcal more)
- Recommend 2–3 beginner-friendly exercises (e.g., walking, bodyweight workouts).
- If user sends calorie intake data (e.g., "caloriesHistory"), factor it into your analysis.

Additional rules:
- ONLY answer questions about fitness, health, exercise, or nutrition.
- If the user asks unrelated things (e.g., jokes, tech help), politely say you are a fitness-focused AI.
- Always speak with encouragement and positivity, like a friendly personal trainer.
`;


app.post('/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const prompt = `${BASE_SYSTEM_PROMPT}\n\nUser message: ${message}`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        systemInstruction: { parts: [{ text: BASE_SYSTEM_PROMPT }] }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const reply = response.data.candidates[0].content.parts[0].text || "No response from Gemini.";
    res.json({ reply });
  } catch (error) {
    console.error("Error from Gemini API:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to get response from Gemini." });
  }
});

app.listen(port, () => {
  console.log(`Gemini backend server running on port ${port}`);
});