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

// Create the groups table in the database if it doesn't exist
db.run(
  `CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
   )`,
   (error) => {
     if (error) {
      console.error('Error creating groups table:', error.message);
    } else {
      console.log('Groups table created successfully');
    }
   }
);

// Create the group_members table in the database if it doesn't exist
db.run(
    `CREATE TABLE IF NOT EXISTS group_members (
     group_id INTEGER NOT NULL,
     email TEXT NOT NULL,
     FOREIGN KEY (group_id) REFERENCES groups(id)
   )`,
   (error) => {
     if (error) {
       console.error('Error creating group_members table:', error.message);
     } else {
       console.log('Group_members table created successfully');
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

  //usage
  //to send to 1 email   "to": "email@email.com"
  //to send to multiple emails   "to": ["email@email.com", "email2.email.com", "email3.email.com"]

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { to, type } = req.body;

  // Check if required fields are missing
  if (!to) {
    return res.status(400).send('Missing to');
  }
  if (!type) {
    return res.status(400).send('Missing type');
  }

  const recipients = to.toString().split(',');
  let subject, message;

  //different types of notifications
  switch (type) {
    case 'ticket_buy':

      // const response = await axios.get('https://example.com/tickets', { params: { email: to } });
      // const tickets = response.data;

      // Extract the relevant information from the response
      // const ticketNumbers = tickets.map(ticket => ticket.number).join(', ');

      //send notification when a user buys 1 ticket

      if(recipients.length == 1 ){
        subject = 'Ticket purchase confirmation';
        message = `Dear ${to}, Thank you for your purchase. Your ticket(s) have been confirmed. Yoru ticket info... `;
      }
      else{
        return res.status(400).json({ message: 'Recipients size must be 1' });
      }
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

      //send an email to user when user is registing
      if(recipients.length == 1 ){
        const { url_link_verification } = req.body;

        // Check if required fields are missing
        if (!url_link_verification) {
          return res.status(400).send('Missing url_link_verification');
        }

        subject = 'Email Verification';
        message = `Dear ${to}, Thank you for signing up with us. To complete your registration, please verify your email address by clicking the link:  ${url_link_verification}`
      }
      else{
        return res.status(400).json({ message: 'Recipients size must be 1' });
      }
      break;
    case 'ticket_sell':

      //send email to user about the ticket sell
      if(recipients.length == 1 ){

        const { ticket_ID } = req.body;
        const { url_link_sell_verification } = req.body;

        // Check if required fields are missing
        if (!ticket_ID) {
          return res.status(400).send('Missing ticket_ID');
        }
        if (!url_link_sell_verification) {
          return res.status(400).send('Missing url_link_sell_verification');
        }

        subject = 'Ticket Sell';
        message = `Dear ${to}, we are pleased to inform you that your ticket ${ticket_ID} has been sold successfully. Click here to complete the sale: ${url_link_sell_verification}`;
      }
      else{
        return res.status(400).json({ message: 'Recipients size must be 1' });
      }
      break;

    case 'confirmation_ticket_sell':
      //send email to both persons in the ticket sell
      if(recipients.length == 2 ){
        subject = 'Confirmation_ticket_sell';
        message = `Dears ${to}, we are pleased to inform that transfer was successfull`;
      }
      else{
        return res.status(400).json({ message: 'Recipients size must be 2' });
      }
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


//API endpoint to create a group
app.post('/group', async (req, res) => {
  const { name } = req.body;

  // Check if required fields are missing
  if (!name) {
    return res.status(400).send('Missing required fields');
  }

  db.get(
    `SELECT * FROM groups WHERE name = ?`,
    [name],
    (error, row) => {
      if (error) {
        console.error('Error selecting:', error.message);
      } else if (row) {
        console.log('Group already exists:', row);
        return res.status(200).send('Group already exists');
      } else {
        db.run(
          `INSERT INTO groups (name)
          VALUES (?)`,
          [name],
          (error) => {
            if (error) {
              console.error('Error inserting:', error.message);
            } else {
              console.log('Inserted');
            }
          }
        );
      }
    }
  );

});

//API endpoint to delete a group
app.delete('/groups/remove/:name', async (req, res) => {

  const name = req.params.name;

  db.run(`DELETE FROM groups WHERE name = ?`, name, (error) => {
    if (error) {
      console.error('Error deleting group from database:', error.message);
      res.status(500).send('Error deleting group');
    } else {
      res.status(200).send(`Group with name ${name} deleted successfully`);
    }
  });

});

//API endpoint to add users to a group
app.put('/groups/:id/members', (req, res) => {
  const groupId = req.params.id;
  const members = req.body.members;

  // Add members to the group with the given ID
  db.serialize(() => {
    const stmt = db.prepare('INSERT INTO group_members (group_id, email) VALUES (?, ?)');
    members.forEach(member => {
      stmt.run(groupId, member);
    });
    stmt.finalize();
  });

  res.send('Members added to group');
});

//API endpoint to get all users in each groupID
app.get('/groups', (req, res) => {

  // Retrieve all notifications from the database
  db.all(`SELECT * FROM group_members`, (error, rows) => {
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