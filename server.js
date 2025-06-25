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

function isUserInfoComplete(userInfo) {
  return info.name && info.gender && info.age && info.height && info.weight;
}

app.post('/chat', async (req, res) => {
    const {message, sessionID = 'default',caloriesHistory} = req.body;

    if(!message) {
        return res.status(400).json({error: 'Message is required'});
    }

  if (!sessions[sessionID]) {
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
    const extractInfo = (key, pattern) => {
      const match = message.match(pattern);
      if (match) session.userInfo[key] = match[1];
    };

    extractInfo('name', /name\s*is\s*(\w+)/i);
    extractInfo('gender', /gender\s*is\s*(male|female|other)/i);
    extractInfo('age', /(\d+)\s*years?\s*old/i);
    extractInfo('height', /(\d+)\s*cm/i);
    extractInfo('weight', /(\d+)\s*kg/i);

    const missing = ONBOARDING_QUESTIONS.filter(q =>{
      if (q.includes("name"))return !sessions[sessionID].userInfo.name;
      if (q.includes("gender"))return !sessions[sessionID].userInfo.gender;
      if (q.includes("age"))return !sessions[sessionID].userInfo.age;
      if (q.includes("height"))return !sessions[sessionID].userInfo.height;
      if (q.includes("weight"))return !sessions[sessionID].userInfo.weight;
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
