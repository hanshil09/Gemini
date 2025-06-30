console.log("Starting Gemini Backend...");

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

require('dotenv').config();
console.log("Loaded API key:", process.env.GEMINI_API_KEY);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const sessions = {};

const BASE_SYSTEM_PROMPT = `
You are a professional AI fitness and nutrition coach. Your role is to provide accurate and helpful advice related to:
- Exercise & workouts
- Weight loss, gain, or maintenance
- Healthy eating and diets
- Nutritional plans and calorie intake
- Fitness habits, beginner tips, and meal planning

Do not answer questions unrelated to fitness, health, food, or exercise. If a question is outside this scope (e.g., politics, tech), respond politely: "I'm sorry, I only focus on fitness and nutrition. How can I assist you with your health goals?"

When provided with user information (name, gender, age, height in cm, weight in kg), calculate their BMI, determine their weight status (underweight, normal weight, overweight, obese), and provide daily calorie targets for maintenance, weight loss, and weight gain. Include beginner fitness tips tailored to their profile.
`;

const ONBOARDING_QUESTIONS = [
  "What is your name?",
  "What is your gender? (Male/Female/Other)",
  "What is your age? (in years)",
  "What is your height? (in cm)",
  "What is your weight? (in kg)"
];

function isUserInfoComplete(info) {
  return info.name && info.gender && info.age && info.height && info.weight;
}

app.post('/chat', async (req, res) => {
  const { message, sessionId = 'default', caloriesHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Initialize session if it doesn't exist
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      history: [
        { role: "user", parts: "Hello" },
        { role: "model", parts: "Hi! I'm your fitness and nutrition coach. Let's get started." }
      ],
      userInfo: {}
    };
  }

  const session = sessions[sessionId];

  // Handle onboarding questions
  if (!isUserInfoComplete(session.userInfo)) {
    // Extract user information from the message
    const userInfo = session.userInfo;
    const words = message.trim().split(/\s+/);

    if (!userInfo.name) {
      for (const word of words) {
        if (/^[A-Z][a-z]+$/.test(word) && !['Male', 'Female', 'Other'].includes(word)) {
          userInfo.name = word;
          break;
        }
      }
    }

    if (!userInfo.gender) {
      const genderMatch = message.match(/\b(male|female|other)\b/i);
      if (genderMatch) userInfo.gender = genderMatch[1];
    }

    if (!userInfo.age) {
      const ageMatch = message.match(/(\d{1,3})\s*(years?\s*old)?/i);
      if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        if (age >= 5 && age <= 120) userInfo.age = age;
      }
    }

    if (!userInfo.height) {
      const heightMatch = message.match(/(\d{2,3})\s*cm/i);
      if (heightMatch) userInfo.height = parseInt(heightMatch[1]);
    }

    if (!userInfo.weight) {
      const weightMatch = message.match(/(\d{2,3})\s*kg/i);
      if (weightMatch) userInfo.weight = parseInt(weightMatch[1]);
    }

    const missing = ONBOARDING_QUESTIONS.filter(q => {
      if (q.includes("name")) return !session.userInfo.name;
      if (q.includes("gender")) return !session.userInfo.gender;
      if (q.includes("age")) return !session.userInfo.age;
      if (q.includes("height")) return !session.userInfo.height;
      if (q.includes("weight")) return !session.userInfo.weight;
      return false;
    });

    if (missing.length > 0) {
      return res.json({ reply: missing[0] });
    } else {
      // User info is complete, send to Gemini for BMI and recommendations
      const { name, gender, age, height, weight } = session.userInfo;
      const prompt = `
        User profile:
        - Name: ${name}
        - Gender: ${gender}
        - Age: ${age} years
        - Height: ${height} cm
        - Weight: ${weight} kg

        Please calculate the user's BMI, determine their weight status (underweight, normal weight, overweight, obese), and provide daily calorie targets for maintaining weight, losing weight, and gaining weight. Also include beginner fitness tips tailored to their profile.
      `;

      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.0-flash", // Use a valid model name
          systemInstruction: BASE_SYSTEM_PROMPT
        });

        const chat = model.startChat({ history: session.history });
        const result = await chat.sendMessage(prompt);
        const reply = result.response.text() || "No response from Gemini.";

        session.history.push({ role: "user", parts: prompt });
        session.history.push({ role: "model", parts: reply });
        return res.json({ reply });
      } catch (error) {
        console.error("Error from Gemini API:", error);
        return res.status(500).json({ error: "Failed to get response from Gemini." });
      }
    }
  }

  // Handle regular chat messages
  let prompt = message;
  if (caloriesHistory) {
    prompt = `
      Today's calorie intake: ${caloriesHistory} kcal.
      User message: ${message}
    `;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Use a valid model name
      systemInstruction: BASE_SYSTEM_PROMPT
    });

    // Ensure history starts with a user message
    const chatHistory = [...session.history];
    if (chatHistory.length === 0 || chatHistory[0].role !== "user") {
      chatHistory.unshift({ role: "user", parts: "Hello" });
    }

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(prompt);
    const reply = result.response.text() || "No response from Gemini.";

    session.history.push({ role: "user", parts: prompt });
    session.history.push({ role: "model", parts: reply });
    res.json({ reply });
  } catch (error) {
    console.error("Error from Gemini API:", error);
    res.status(500).json({ error: "Failed to get response from Gemini." });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Gemini backend server running on port ${port}`);
});