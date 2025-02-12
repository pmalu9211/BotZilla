const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const axios = require('axios'); // Make sure axios is imported!
const moment = require('moment-timezone');

const app = express();
const port = 3005;

app.use(cors());
app.use(express.json());

// MySQL Connection Pool Configuration
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'rootpassword',
  database: 'meetings_db',
  port: 3306,
  timezone: 'Z', // We treat stored DATETIME as IST (handled below)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// GET /confirmations - Retrieve only pending confirmations.
app.get('/confirmations', (req, res) => {
  const query = `
    SELECT id, recipient_name, title, timing, status, json_string 
    FROM meeting_confirmations
    WHERE status = 'pending'
  `;
  pool.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching confirmations:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    // Convert the stored naive timing (in IST) to an ISO string with IST offset.
    const updatedResults = results.map(record => {
      // Here we assume the stored time is in the format "YYYY-MM-DD HH:mm:ss" (IST)
      record.timing = moment.tz(record.timing, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata").format();
      return record;
    });
    res.json(updatedResults);
  });
});

// GET /confirmations/:id - Retrieve a specific confirmation.
app.get('/confirmations/:id', (req, res) => {
  const id = req.params.id;
  pool.query(
    'SELECT id, recipient_name, title, timing, status, json_string FROM meeting_confirmations WHERE id = ?',
    [id],
    (error, results) => {
      if (error) {
        console.error('Error fetching confirmation:', error);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: 'Confirmation not found' });
      }
      // Convert stored timing (IST naive) to an ISO string with offset.
      results[0].timing = moment.tz(results[0].timing, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata").format();
      res.json(results[0]);
    }
  );
});

// PUT /confirmations/:id - Update a meeting confirmation.
// If updated to "confirmed", call the calendar API in the background.
app.put('/confirmations/:id', (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  if (!status || !['confirmed', 'pending', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Update the record immediately regardless of further processing.
  pool.query(
    'UPDATE meeting_confirmations SET status = ? WHERE id = ?',
    [status, id],
    (updateError, updateResults) => {
      if (updateError) {
        console.error('Error updating confirmation:', updateError);
        return res.status(500).json({ error: 'Database error' });
      }
      if (updateResults.affectedRows === 0) {
        return res.status(404).json({ error: 'Confirmation not found' });
      }

      // If rejected, simply return success.
      if (status !== 'confirmed') {
        return res.json({ message: 'Confirmation updated successfully' });
      }

      // For confirmed status, call the calendar API in the background.
      pool.query('SELECT * FROM meeting_confirmations WHERE id = ?', [id], async (selectError, results) => {
        if (selectError) {
          console.error('Error retrieving updated confirmation:', selectError);
          // Even if retrieval fails, return success since the status is already updated.
          return res.json({ message: 'Confirmation updated successfully' });
        }
        if (results.length === 0) {
          return res.json({ message: 'Confirmation updated successfully' });
        }
        const record = results[0];
        let schedulePayload = {};
        try {
          schedulePayload = JSON.parse(record.json_string);
        } catch (parseError) {
          console.error('Error parsing json_string:', parseError);
          // Return success even if the payload is invalid.
          return res.json({ message: 'Confirmation updated successfully' });
        }
        try {
          // Call the Calendar API on port 3000.
          const calendarResponse = await axios.post("http://localhost:3000/api/meetings", schedulePayload);
          console.log('Calendar API response:', calendarResponse.data);
        } catch (calendarError) {
          console.error('Error calling calendar API:', calendarError.message);
          // Log the error, but still return success.
        }
        return res.json({ message: 'Confirmation updated successfully' });
      });
    }
  );
});

// DELETE /confirmations/:id - Delete a meeting confirmation.
app.delete('/confirmations/:id', (req, res) => {
  const id = req.params.id;
  pool.query('DELETE FROM meeting_confirmations WHERE id = ?', [id], (error, results) => {
    if (error) {
      console.error('Error deleting confirmation:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Confirmation not found' });
    }
    res.json({ message: 'Confirmation deleted successfully' });
  });
});

app.listen(port, () => {
  console.log(`Express confirmations server is running on port ${port}`);
});
