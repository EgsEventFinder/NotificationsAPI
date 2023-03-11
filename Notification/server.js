const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
const sqlite3 = require("sqlite3").verbose();
const { body, validationResult } = require('express-validator');

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

// API endpoint to get index to test
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/templates/index2.html')
})

// API endpoint to send email
app.post('/notification', async (req, res) => {

  // const { to, subject, message } = req.body;

  // // Check if required fields are missing                        //code for the situation that we want to write our custom subject and our custom message
  // if (!to || !subject || !message) {
  //   return res.status(400).send('Missing required fields');
  // }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }


  const { to, type } = req.body;
  const recipients = to.toString().split(',');
  let subject, message;

  //different types of notifications

  switch (type) {
    case 'ticket_buy':

      // const response = await axios.get('https://example.com/tickets', { params: { email: to } });
      // const tickets = response.data;

      // Extract the relevant information from the response
      // const ticketNumbers = tickets.map(ticket => ticket.number).join(', ');

      subject = 'Ticket purchase confirmation';
      message = `Dear ${to}, Thank you for your purchase. Your ticket(s) have been confirmed. Yoru ticket info... `;
      break;
    case 'event_cancelation':

      subject = 'Event cancellation';
      message = 'We regret to inform you that the event, [Event Name] you registered for has been canceled.';
      break;
    case 'ticket_refund':

      subject = 'Ticket refund';
      message = 'Your ticket has been refunded in full.';
      break;
    case 'event_announcement':

      subject = 'Event Announcement';
      message = 'We are excited to announce a new event, [Event Name], and we hope you will be able to attend.';
      break;
    case 'special_offer':

      subject = 'Special Offer';
      message = 'We would like to offer you a special discount on your next ticket purchase.';
      break;
    case 'thank_you_email':

      subject = 'Thank you for attending';
      message = 'We wanted to take a moment to thank you for attending [Event Name]. We hope you had a great time and enjoyed the Event';
      break;
    case 'schedule_change':

      subject = 'Schedule Change';
      message = 'We wanted to let you know that there has been a change to the schedule for [Event Name]. We apologize for any inconvenience this may cause and hope that you can still attend. If you are unable to attend the event due to this change, please contact us for a refund.';
      break;
    case 'email_verification':

      const { url_link_verification } = req.body;
      
      subject = 'Email Verification';
      message = `Dear ${to}, Thank you for signing up with us. To complete your registration, please verify your email address by clicking the link:  ${url_link_verification}`
      break;
    case 'ticket_sell':

      const { ticket_ID } = req.body;
      const { url_link_sell_verification } = req.body;

      subject = 'Ticket Sell';
      message = `Dear ${to}, we are pleased to inform you that your ticket ${ticket_ID} has been sold successfully. Click here to complete the sale: ${url_link_sell_verification}`;
      break;

    case 'confirmation_ticket_sell':

      subject = 'Confirmation_ticket_sell';
      message = `Dears ${to}, we are pleased to inform that transfer was successfull`;
      break;
    default:
      return res.status(400).json({ message: 'Invalid notification type' });
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

  for (let i = 0; i < recipients.length; i++) {
    db.run(
      `INSERT INTO notifications (email, subject, message, created_at)
      VALUES (?, ?, ?, datetime('now'))`,
      [recipients[i], subject, message],
      (error) => {
        if (error) {
          console.error('Error inseerting:', error.message);
        } else {
          console.log('Inserted');
        }
      }
    );
  }

  try {
    await sgMail.send(email);
    return res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error sending email');
  }
});

// API endpoint to get all notifications
app.get('/notifications', (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

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


// API endpoint to get all notification of a given user by email
app.get('/notifications/:email', (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const email = req.params.email;

  // Retrieve notifications from the database that match the specified email
  db.all(`SELECT * FROM notifications WHERE email = ?`, [email], (error, rows) => {
    if (error) {
      console.error('Error retrieving notifications from database:', error.message);
      res.status(500).send('Error retrieving notifications');
    } else {
      res.status(200).json(rows);
    }
  });
});

// API endpoint to delete a notification by ID
app.delete('/notifications/remove/id/:id', (req, res) => {
  const id = parseInt(req.params.id);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Delete the notification from the database
  db.run(`DELETE FROM notifications WHERE id = ?`, id, (error) => {
    if (error) {
      console.error('Error deleting notification from database:', error.message);
      res.status(500).send('Error deleting notification');
    } else {
      res.status(200).send(`Notification with ID ${id} deleted successfully`);
    }
  });
});

// API endpoint to delete all notifications of a user by email
app.delete('/notifications/remove/email/:email', (req, res) => {
  const email = req.params.email;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Delete the notifications from the database
  db.run(`DELETE FROM notifications WHERE email = ?`, email, (error) => {
    if (error) {
      console.error('Error deleting notifications from database:', error.message);
      res.status(500).send('Error deleting notification');
    } else {
      res.status(200).send(`Notifications with email ${email} deleted successfully`);
    }
  });
});

app.listen(3000, () => {
  console.log('App listening on port localhost:3000 !')
})