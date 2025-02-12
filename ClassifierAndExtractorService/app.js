const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();

// Enable CORS
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ Hello: "World" });
});

app.post("/response/meetingornot", async (req, res) => {
  const { email } = req.body;

  const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.API_KEY_1
  });

  const conversation = [
    {
      role: "system",
      content:
        "You are an email classifier. Determine if the email is about scheduling a meeting, assigning a task to someone, or something else. Respond only with 'meeting', 'task', or 'no'.",
    },
    {
      role: "user",
      content: email,
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: "meta/llama3-70b-instruct",
      messages: conversation,
      temperature: 0,
      top_p: 1,
      max_tokens: 5,
    });

    const result = response.choices[0].message.content.trim().toLowerCase();
    res.json(result);
  } catch (e) {
    console.error("Error during API call:", e);
    res.status(500).json("no");
  }
});

app.post("/response/meetingTime", async (req, res) => {
  const indiaDate = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  const todayDate = new Date(indiaDate).toISOString().split("T")[0];
  const { email_body } = req.body;

  const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.API_KEY_2
  });

  // Updated system prompt: extract the meeting date, start time, end time, summary, and attendees.
  // Instead of converting to ISO 8601 IST, simply extract the time mentioned and convert it to a 24-hour format (e.g., "10 am" → "10:00", "10 pm" → "22:00").
  const conversation = [
    {
      role: "system",
      content: `Extract the sender email and receiver email from the provided email and combine them into an array called "attendees". Also extract the meeting date, meeting start time, meeting end time, and meeting summary from the email.
      Do not add any timezone or ISO formatting; simply extract the time mentioned in the email and convert it to a 24-hour format (for example, "10 am" should be "10:00" and "10 pm" should be "22:00").
      For the meeting date, ensure it is returned in the format "YYYY-MM-DD" (e.g., "2025-02-09" is 9 feb 2025). If the date is not specified, consider today as ${todayDate} in the format (year-month-date). 
      If the email only proposes a meeting time without confirmation, set both start and end as null.
      If the meeting end time is not specified or the meeting duration is undefined, set end as null.
      If the meeting summary cannot be extracted, default it to "meeting".
      Return the result as a valid JSON object with the following keys:
        - date
        - start
        - end
        - summary
        - attendees
      The response must be ONLY the JSON object with no additional text or explanation.`,
    },
    {
      role: "user",
      content: email_body,
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: "meta/llama3-70b-instruct",
      messages: conversation,
      temperature: 0.5,
      top_p: 1,
      max_tokens: 1024,
    });

    const rawOutput = response.choices[0].message.content.trim();
    console.log("Raw API Response:", rawOutput);

    // Try to parse the output as JSON directly.
    let parsedOutput;
    try {
      parsedOutput = JSON.parse(rawOutput);
      parsedOutput.start =
        parsedOutput.date + "T" + parsedOutput.start + ":00+05:30"; //(e.g., "2025-03-01T10:00:00+05:30").
      parsedOutput.end =
        parsedOutput.date + "T" + parsedOutput.end + ":00+05:30";
    } catch (error) {
      // If direct parsing fails, attempt to extract a JSON block using regex.
      const jsonRegex = /({[\s\S]*})/;
      const match = rawOutput.match(jsonRegex);
      if (match) {
        try {
          parsedOutput = JSON.parse(match[1]);
        } catch (innerError) {
          console.error("Error parsing extracted JSON:", innerError);
          return res.status(500).json({ error: "Invalid JSON format" });
        }
      } else {
        console.error("No JSON block found in the output");
        return res
          .status(500)
          .json({ error: "No JSON block found in the output" });
      }
    }
    res.json(parsedOutput);
  } catch (e) {
    console.error("Error during API call:", e);
    res.status(500).json(null);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
