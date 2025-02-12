require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const axios = require("axios"); // Import axios here!
const pool = require("./database"); // Your database connection module
const moment = require('moment-timezone');
const cors = require('cors');


const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "a-very-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// Helper functions to get/store tokens
async function getStoredTokens() {
  const [rows] = await pool.query("SELECT tokens FROM users WHERE id = 1");
  if (rows && rows.length > 0 && rows[0].tokens) {
    try {
      return JSON.parse(rows[0].tokens);
    } catch (error) {
      throw new Error("Failed to parse stored tokens.");
    }
  }
  return null;
}
async function storeTokens(tokens, email) {
  const tokensString = JSON.stringify(tokens);
  const sql = `
    INSERT INTO users (id, email, tokens)
    VALUES (1, ?, ?)
    ON DUPLICATE KEY UPDATE email = VALUES(email), tokens = VALUES(tokens)
  `;
  await pool.query(sql, [email, tokensString]);
}

// OAuth2 Endpoints
app.get("/auth", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.redirect(authUrl);
});
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided.");
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const email = "user@example.com"; // Replace with actual email
    await storeTokens(tokens, email);
    res.send("Authentication successful! You can now use the API endpoints.");
  } catch (error) {
    console.error("OAuth2 callback error:", error);
    res.status(500).send("Authentication error.");
  }
});

// Middleware to ensure the user is authenticated.
async function ensureAuthenticated(req, res, next) {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) {
      return res
        .status(401)
        .json({
          error: "User not authenticated. Please authenticate first via /auth",
        });
    }
    oauth2Client.setCredentials(tokens);
    req.oauth2Client = oauth2Client;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Error retrieving stored tokens." });
  }
}

/**
 * GET /api/freebusy - Check if a given time slot is free.
 * Expects query parameters 'start' and 'end' that are valid date strings.
 */
app.get("/api/freebusy", ensureAuthenticated, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res
      .status(400)
      .json({ error: "Missing start or end query parameter" });
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res
      .status(400)
      .json({ error: "Invalid start or end query parameter" });
  }
  const calendar = google.calendar({ version: "v3", auth: req.oauth2Client });
  try {
    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: "primary" }],
      },
    });
    const busyTimes = freeBusyResponse.data.calendars.primary.busy;
    if (busyTimes && busyTimes.length > 0) {
      return res.json({ busy: true, busyTimes });
    } else {
      return res.json({ busy: false });
    }
  } catch (error) {
    console.error("Error in freebusy check:", error);
    return res
      .status(500)
      .json({ error: "Error checking free busy", details: error.message });
  }
});

app.get("/api/todaySchedule", ensureAuthenticated, async (req, res) => {
  const calendar = google.calendar({ version: "v3", auth: req.oauth2Client });
  try {
    // Define today's date in IST.
    const today = moment.tz("Asia/Kolkata").startOf("day");
    const startOfDay = today
      .clone()
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    const endOfDay = today
      .clone()
      .set({ hour: 17, minute: 0, second: 0, millisecond: 0 });

    // Fetch events between 9 AM and 5 PM.
    const eventsResponse = await calendar.events.list({
      calendarId: "primary",
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });
    let events = eventsResponse.data.items || [];
    // Format events into a simpler structure.
    let scheduledEvents = events.map((ev) => ({
      id: ev.id,
      title: ev.summary,
      start: ev.start.dateTime || ev.start.date,
      end: ev.end.dateTime || ev.end.date,
    }));

    // Check if a lunch break exists between 12:30 and 13:30.
    const lunchStart = today.clone().set({ hour: 12, minute: 30 });
    const lunchEnd = today.clone().set({ hour: 13, minute: 30 });
    let hasLunch = scheduledEvents.some((ev) => {
      const evStart = moment(ev.start);
      const evEnd = moment(ev.end);
      // If any event completely covers the lunch period.
      return evStart.isBefore(lunchStart) && evEnd.isAfter(lunchEnd);
    });
    if (!hasLunch) {
      scheduledEvents.push({
        id: "lunch-break",
        title: "Lunch Break",
        start: lunchStart.format(),
        end: lunchEnd.format(),
      });
    }

    // Calculate free slots (using a 30-minute meeting duration as an example).
    const meetingDurationMs = 30 * 60 * 1000;
    const freeSlots = await findAvailableSlots(
      calendar,
      meetingDurationMs,
      today.format("YYYY-MM-DD"),
      { start: "09:00", end: "17:00" }
    );

    res.json({ scheduledEvents, freeSlots });
  } catch (error) {
    console.error("Error fetching today's schedule:", error);
    res
      .status(500)
      .json({
        error: "Failed to fetch today's schedule",
        details: error.message,
      });
  }
});

async function findAvailableSlots(calendar, meetingDurationMs, day, workingHours = { start: "09:00", end: "17:00" }) {
  // day is a string (e.g. "2025-02-21"); working in IST.
  const [startHour, startMin] = workingHours.start.split(":").map(Number);
  const [endHour, endMin] = workingHours.end.split(":").map(Number);

  // Create day start/end moments in IST.
  let dayStart = moment.tz(day, "YYYY-MM-DD", "Asia/Kolkata").set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 });
  let dayEnd = moment.tz(day, "YYYY-MM-DD", "Asia/Kolkata").set({ hour: endHour, minute: endMin, second: 0, millisecond: 0 });

  // Query free/busy for the day’s working hours.
  const freeBusyResponse = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: 'primary' }]
    }
  });
  let busyIntervals = freeBusyResponse.data.calendars.primary.busy || [];
  busyIntervals.sort((a, b) => new Date(a.start) - new Date(b.start));

  // Build free intervals.
  let freeIntervals = [];
  let current = dayStart.clone();
  busyIntervals.forEach(busy => {
    let busyStart = moment(busy.start);
    if (current.isBefore(busyStart)) {
      freeIntervals.push({ start: current.clone(), end: busyStart.clone() });
    }
    let busyEnd = moment(busy.end);
    if (current.isBefore(busyEnd)) {
      current = busyEnd.clone();
    }
  });
  if (current.isBefore(dayEnd)) {
    freeIntervals.push({ start: current.clone(), end: dayEnd.clone() });
  }

  // Generate candidate slots of meetingDurationMs aligned to 30-minute boundaries.
  let candidateSlots = [];
  let candidate = dayStart.clone();
  // Align candidate to nearest 30-minute boundary.
  if (candidate.minutes() % 30 !== 0) {
    candidate.minutes(candidate.minutes() < 30 ? 30 : 0).seconds(0).milliseconds(0);
    if (candidate.minutes() === 0) candidate.add(1, 'hour');
  }
  while (candidate.clone().add(meetingDurationMs, 'milliseconds').isSameOrBefore(dayEnd)) {
    let slotStart = candidate.clone();
    let slotEnd = candidate.clone().add(meetingDurationMs, 'milliseconds');
    let fits = freeIntervals.some(interval => slotStart.isSameOrAfter(interval.start) && slotEnd.isSameOrBefore(interval.end));
    if (fits) {
      candidateSlots.push({
        start: slotStart.format(),
        end: slotEnd.format()
      });
    }
    candidate.add(30, 'minutes');
  }
  return candidateSlots;
}


// Schedule a new meeting.
app.post("/api/meetings", ensureAuthenticated, async (req, res) => {
  const { summary, start, end, attendees } = req.body;
  if (!summary || !start || !end) {
    return res
      .status(400)
      .json({ error: "Missing required fields: summary, start, end" });
  }
  const isoStart = new Date(start).toISOString();
  const isoEnd = new Date(end).toISOString();
  const calendar = google.calendar({ version: "v3", auth: req.oauth2Client });
  try {
    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: isoStart,
        timeMax: isoEnd,
        items: [{ id: "primary" }],
      },
    });
    const busyTimes = freeBusyResponse.data.calendars.primary.busy;
    if (busyTimes && busyTimes.length > 0) {
      return res
        .status(409)
        .json({ error: "Time slot not available", availableSlots: [] });
    }
    const event = {
      summary,
      start: { dateTime: isoStart, timeZone: "Asia/Kolkata" },
      end: { dateTime: isoEnd, timeZone: "Asia/Kolkata" },
      conferenceData: {
        createRequest: {
          requestId: "req-" + Date.now(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };
    if (attendees && Array.isArray(attendees)) {
      event.attendees = attendees.map((email) => ({ email }));
    }
    const eventResponse = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      conferenceDataVersion: 1,
    });
    res.json({
      message: "Meeting scheduled successfully",
      event: eventResponse.data,
    });
  } catch (error) {
    console.error("Error scheduling meeting:", error);
    res
      .status(500)
      .json({ error: "Error scheduling meeting", details: error.message });
  }
});

// List upcoming meetings.
app.get("/api/meetings", ensureAuthenticated, async (req, res) => {
  const calendar = google.calendar({ version: "v3", auth: req.oauth2Client });
  try {
    const now = new Date().toISOString();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    const maxDateISO = maxDate.toISOString();
    const eventsResponse = await calendar.events.list({
      calendarId: "primary",
      timeMin: now,
      timeMax: maxDateISO,
      singleEvents: true,
      orderBy: "startTime",
    });
    res.json({ events: eventsResponse.data.items });
  } catch (error) {
    console.error("Error listing meetings:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch meetings", details: error.message });
  }
});

// Cancel a meeting.
app.delete("/api/meetings/:id", ensureAuthenticated, async (req, res) => {
  const meetingId = req.params.id;
  const calendar = google.calendar({ version: "v3", auth: req.oauth2Client });
  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId: meetingId,
    });
    res.json({ message: "Meeting cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling meeting:", error);
    res
      .status(500)
      .json({ error: "Error cancelling meeting", details: error.message });
  }
});

// Reschedule a meeting.
app.put("/api/meetings/:id", ensureAuthenticated, async (req, res) => {
  const meetingId = req.params.id;
  const { summary, start, end } = req.body;
  if (!summary || !start || !end) {
    return res
      .status(400)
      .json({ error: "Missing required fields: summary, start, end" });
  }
  const isoStart = new Date(start).toISOString();
  const isoEnd = new Date(end).toISOString();
  const calendar = google.calendar({ version: "v3", auth: req.oauth2Client });
  try {
    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: isoStart,
        timeMax: isoEnd,
        items: [{ id: "primary" }],
      },
    });
    const busyTimes = freeBusyResponse.data.calendars.primary.busy;
    if (busyTimes && busyTimes.length > 0) {
      return res
        .status(409)
        .json({ error: "New time slot not available", availableSlots: [] });
    }
    const event = {
      summary,
      start: { dateTime: isoStart, timeZone: "Asia/Kolkata" },
      end: { dateTime: isoEnd, timeZone: "Asia/Kolkata" },
    };
    const updatedEventResponse = await calendar.events.update({
      calendarId: "primary",
      eventId: meetingId,
      requestBody: event,
    });
    res.json({
      message: "Meeting rescheduled successfully",
      event: updatedEventResponse.data,
    });
  } catch (error) {
    console.error("Error rescheduling meeting:", error);
    res
      .status(500)
      .json({ error: "Error rescheduling meeting", details: error.message });
  }
});

// LLM Endpoints

// /response/meetingornot
app.post("/response/meetingornot", async (req, res) => {
  const { email } = req.body;
  // (LLM code remains largely unchanged; use your API key and model as needed.)
  res.json("yes");
});

// /response/meetingTime endpoint.
// This endpoint forwards the request to the external LLM endpoint.
app.post("/response/meetingTime", async (req, res) => {
  try {
    const response = await axios.post(
      "https://spitparserapi.onrender.com/response/meetingTime",
      req.body,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Error calling external LLM endpoint:", error.message);
    res
      .status(500)
      .json({
        error: "Error calling external LLM endpoint",
        details: error.message,
      });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
