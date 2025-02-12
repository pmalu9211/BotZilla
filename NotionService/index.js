require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Client } = require('@notionhq/client');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize clients
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const groqClient = axios.create({
  baseURL: 'https://api.groq.com/openai/v1',
  headers: {
    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    'Content-Type': 'application/json'
  }
});
// Helper functions
async function parseCommandWithGroq(command) {
  const systemPrompt = `Extract task details from the user's command and return JSON with:
- title (string)
  if relative dates are mentioned consider today as 9th February 2025 Sunday
- due_date (ISO date or null)
- priority (high/medium/low or null)

- labels (array of strings or empty)
- assigned_to (name of the person to whom the task is assigned)

Example output:
{
  "title": "Complete project report",
  "due_date": "2024-05-30",
  "priority": "high",
  "labels": ["work", "urgent"],
  "assigned_to": "Sharvil"
}`;

  try {
    const response = await groqClient.post('/chat/completions', {
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: command }
      ],
      temperature: 0.3,
      max_tokens: 256,
      response_format: { type: "json_object" }
    });

    const parsedData = response.data.choices[0].message.content;
    const result = JSON.parse(parsedData);

    return {
      title: result.title?.trim() || command,
      due_date: result.due_date || null,
      priority: result.priority || null,
      labels: result.labels || [],
      assigned_to: result.assigned_to?.trim() || null
    };
  } catch (error) {
    console.error('Groq API error:', error.response?.data || error.message);
    return {
      title: command,
      due_date: null,
      priority: null,
      labels: [],
      assigned_to: null
    };
  }
}

function validateISODate(dateStr) {
  return !isNaN(Date.parse(dateStr));
}

async function createNotionTask(parsedData) {
  const properties = {
    Title: {
      title: [
        {
          text: {
            content: parsedData.title
          }
        }
      ]
    },
    Status: {
      select: { name: "To Do" }
    }
  };

  if (parsedData.due_date && validateISODate(parsedData.due_date)) {
    properties['Due Date'] = {
      date: { start: parsedData.due_date }
    };
  }

  if (parsedData.priority) {
    properties['Priority'] = {
      select: { name: parsedData.priority.charAt(0).toUpperCase() + parsedData.priority.slice(1) }
    };
  }

  if (parsedData.assigned_to) {
    properties['Assigned To'] = {
      rich_text: [
        {
          text: {
            content: parsedData.assigned_to
          }
        }
      ]
    };
  }

  return await notion.pages.create({
    parent: { database_id: process.env.NOTION_DATABASE_ID },
    properties: properties
  });
}

// Routes
app.post('/process-task', async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: "Command is required" });
    }

    const parsedData = await parseCommandWithGroq(command);
    const notionResponse = await createNotionTask(parsedData);

    res.json({
      status: "success",
      task_url: notionResponse.url,
      parsed_data: parsedData
    });
  } catch (error) {
    console.error('Error processing task:', error);
    res.status(500).json({ error: error.message });
  }
});

function extractTask(page) {
  const titleProperty = page.properties.Title;
  let title = "";
  if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
    title = titleProperty.title.map(part => part.plain_text).join("");
  }

  const status = page.properties.Status?.select?.name || "";
  const dueDate = page.properties["Due Date"]?.date?.start || null;
  const priority = page.properties.Priority?.select?.name || null;
  const assignedTo =
    page.properties["Assigned To"]?.rich_text &&
    page.properties["Assigned To"].rich_text.length > 0
      ? page.properties["Assigned To"].rich_text[0].plain_text
      : null;

  return {
    id: page.id,
    title,
    status,
    dueDate,
    priority,
    assignedTo
  };
}


// ----------------------------------------------------------------------------
// 2. Endpoint to get tasks from Notion, grouped by status
// ----------------------------------------------------------------------------

app.get('/tasks', async (req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
    });
    const tasks = response.results.map(extractTask);

    // Map status values into three sections.
    // Adjust these arrays to match the values in your Notion database.
    const pendingStatuses = ["To Do", "Pending"];
    const workingStatuses = ["In Progress", "Working"];
    const completedStatuses = ["Done", "Completed"];

    const groupedTasks = {
      pending: tasks.filter(task => pendingStatuses.includes(task.status)),
      working: tasks.filter(task => workingStatuses.includes(task.status)),
      completed: tasks.filter(task => completedStatuses.includes(task.status))
    };

    res.json({ status: "success", tasks: groupedTasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: error.message });
  }
});


// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
