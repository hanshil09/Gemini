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

const SYSTEM_PROMPT = `
You are a professional AI fitness coach.
Only answer fitness, nutrition, exercise, and weight management related questions.
Ignore all questions unrelated to fitness.

Start every new conversation by asking the following questions by making form of it and allowing user to input answer in the form:

1. What is your name?
2. What is your gender? (Male/Female/Other)
3. What is your age? (in years)
4. What is your height? (in cm)
5. What is your weight? (in kg)

Once all information is collected:
- Calculate BMI.
- Based on BMI and gender, recommend whether user should maintain, lose, or gain weight.
- Suggest daily calorie intake for:
    a) Weight maintenance
    b) Weight loss (safe loss: 500 kcal deficit)
    c) Weight gain (safe gain: 500 kcal surplus)
- Suggest 2-3 beginner-friendly fitness exercises.
- Provide only fitness-related suggestions.
- If daily calorie intake data is provided, consider that in your answer.
- Politely refuse answering any question outside fitness domain.
`;


app.post('/chat', async (req, res) => {
    const {message, caloriesHistory} = req.body;

    if(!message) {
        return res.status(400).json({error: 'Message is required'});
    }

    let fullPrompt = SYSTEM_PROMPT;;
  

  // If calories history provided, add that context into prompt
  if (caloriesHistory) {
    fullPrompt += `\nUser reported calorie intake today: ${caloriesHistory} kcal.\n`;
  }

  // Append user's message
  fullPrompt += `\nUser: ${message}\n`;

try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(fullPrompt);

    const reply = result.response.text() || "No response from Gemini.";
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
