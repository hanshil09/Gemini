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

 const sessions={};


const BASE_SYSTEM_PROMPT = `
You are a professional AI fitness and nutrition coach.
You can answer any question related to:

- Exercise & workouts
- Weight loss, gain, or maintenance
- Healthy eating and diets
- Nutritional plans and calorie intake
- Fitness habits, beginner tips, and meal planning

Do not answer any question unrelated to fitness, health, food, or exercise.

If a question is outside your scope (like politics, tech, etc.), respond politely that you only focus on fitness and nutrition.
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
    const {message, sessionId = 'default',caloriesHistory} = req.body;

    if(!message) {
        return res.status(400).json({error: 'Message is required'});
    }

  if (!sessions[sessionId]) {
  sessions[sessionId] = {
      history: [
        { role: "system", parts: BASE_SYSTEM_PROMPT }
      ],
      userInfo: {}
    };
  };
    
    const session = sessions[sessionId];
    if (!isUserInfoComplete(session.userInfo)) {
    // Try to extract key-value data from the message
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

    
    const missing = ONBOARDING_QUESTIONS.filter(q =>{
      if (q.includes("name"))return !sessions[sessionId].userInfo.name;
      if (q.includes("gender"))return !sessions[sessionId].userInfo.gender;
      if (q.includes("age"))return !sessions[sessionId].userInfo.age;
      if (q.includes("height"))return !sessions[sessionId].userInfo.height;
      if (q.includes("weight"))return !sessions[sessionId].userInfo.weight;
      return false;

      });
      if (missing.length > 0) {
      return res.json({ reply: missing[0] });
    } else {
      
      const { name, gender, age, height, weight } = session.userInfo;
      const hMeters = parseFloat(height) / 100;
      const bmi = (parseFloat(weight) / (hMeters * hMeters)).toFixed(1);

      let weightStatus = "";
      if (bmi < 18.5) weightStatus = "underweight";
      else if (bmi < 25) weightStatus = "normal weight";
      else if (bmi < 30) weightStatus = "overweight";
      else weightStatus = "obese";

      const maintenance = Math.round(10 * weight + 6.25 * height - 5 * age + (gender.toLowerCase() === "male" ? 5 : -161));
      const loss = maintenance - 500;
      const gain = maintenance + 500;

      const intro = `Thanks, ${name}. Your BMI is ${bmi}, which is considered ${weightStatus}.
Here are your daily calorie targets:
- Maintain weight: ${maintenance} kcal/day
- Weight loss: ${loss} kcal/day
- Weight gain: ${gain} kcal/day

Beginner fitness tips:
- Walking 30 mins daily
- Bodyweight squats (2 sets of 10)
- Light stretching or yoga`;

      const hasUserMessage = session.history.some(msg => msg.role === "user");
      if (!hasUserMessage) {
        session.history.push({ role: "user", parts: "Hi" }); // Dummy user message to satisfy Gemini
      }
      session.history.push({ role: "model", parts: intro });
      return res.json({ reply: intro });
    }

  }



  // If calories history provided, add that context into prompt
  if (caloriesHistory) {
    session.history.push({
      role: "user",
      parts: `Today's calorie intake: ${caloriesHistory} kcal.`
    });
  }

  session.history.push({ role: "user", parts: message });

try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-chat" });
    // ✅ FIX: Ensure first message is from user
  const chatHistory = [...session.history];
  if (chatHistory[0].role === "system") {
    // Insert dummy user message first
    chatHistory.unshift({ role: "user", parts: "Hello" });
  }
    const chat = model.startChat({ history: session.history });
    const result = await chat.sendMessage(message);
    const reply = result.response.text() || "No response from Gemini.";

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
