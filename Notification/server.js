const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
const sqlite3 = require("sqlite3").verbose();

const app = express();

// middleware to parse JSON and urlencoded request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Set up the SQLite3 database connection
const db = new sqlite3.Database('./notifications.db', (error) => {
  if (error) {
    console.error('Error connecting to database:', error.message);
  } else {
    console.log('Database connected successfully');
  }
});

// Create the notifications table in the database if it doesn't exist
db.run(
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  (error) => {
    if (error) {
      console.error('Error creating notifications table:', error.message);
    } else {
      console.log('Notifications table created successfully');
    }
  }
);

// Set SendGrid API key
sgMail.setApiKey('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');

// const emailTemplates = {
//   [emailTypes.BUY_TICKET]: {
//     subject: 'Thank you for buying a ticket!',
//     text: 'Dear {{name}},\n\nThank you for buying a ticket for our event. We look forward to seeing you there!'
//   },
//   [emailTypes.CANCEL_EVENT]: {
//     subject: 'Event cancellation',
//     text: 'Dear {{name}},\n\nWe regret to inform you that our event has been cancelled. We apologize for any inconvenience this may cause.'
//   }
// };


// API endpoint to get index to test 
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

// API endpoint to send email
app.post('/notification', async (req, res) => {
  const { to, subject, message } = req.body;

  // Check if required fields are missing
  if (!to || !subject || !message) {
    return res.status(400).send('Missing required fields');
  }

  const email = {
    to,
    from: 'eventfinderteste@gmail.com',
    templateId:'d-cc6ffeffa0f64ae6b2274f8a6fc5f390',
    dynamicTemplateData: {
      subject,
      text: message
    
  },
  };

  db.run(
    `INSERT INTO notifications (email, subject, message, created_at)
    VALUES (?, ?, ?, datetime('now'))`,
    [to, subject, message],
    (error) => {
      if (error) {
        console.error('Error inseerting:', error.message);
      } else {
        console.log('Inserted');
      }
    }
  );

  try {
    await sgMail.send(email);
    return res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error sending email');
  }

});

// API endpoint to get all notifications
app.get('/notification', (req, res) => {
  // Retrieve all notifications from the database
  db.all(`SELECT * FROM notifications`, (error, rows) => {
    if (error) {
      console.error('Error retrieving notifications from database:', error.message);
      res.status(500).send('Error retrieving notifications');
    } else {
      res.status(200).json(rows);
    }
  });
});

app.listen(3000, () => {
  console.log('App listening on port localhost:3000 !')
})