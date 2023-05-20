const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
//const sqlite3 = require("sqlite3").verbose();
const mysql = require('mysql2');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();

// middleware to parse JSON and urlencoded request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

db.getConnection((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1);
  }

  console.log('Connected to the database');
// Create the notifications table in the database if it doesn't exist
db.query(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INT(11) NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )`, (error) => {
    if (error) {
      console.error('Error creating notifications table:', error.message);
    } else {
      console.log('Notifications table created successfully');
    }
  }
);


// Create the groups table in the database if it doesn't exist
db.query(`
  CREATE TABLE IF NOT EXISTS groupss (
    id INT(11) NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    PRIMARY KEY (id)
  )`, (error) => {
    if (error) {
      console.error('Error creating groups table:', error.message);
    } else {
      console.log('Groups table created successfully');
    }
  }
);

db.query(`
  CREATE TABLE IF NOT EXISTS groupss_members (
    group_id INT(11) NOT NULL,
    email VARCHAR(255) NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groupss(id)
  )`, (error) => {
    if (error) {
      console.error('Error creating group_members table:', error.message);
    } else {
      console.log('Group_members table created successfully');
    }
  }
);

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// API endpoint to get index to test
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/templates/index2.html')
})


// API endpoint to send email
app.post('/notification', async (req, res) => {

  const { to, subject, message } = req.body;

   // Check if required fields are missing                        //code for the situation that we want to write our custom subject and our custom message
  if (!to ) {
    return res.status(400).send('Missing "to" parameter');
   }

   if (!subject) {
    return res.status(400).send('Missing "subject" parameter');
   }

   if (!message) {
    return res.status(400).send('Missing "message" parameter');
   }

  //usage
  //to send to 1 email   "to": "email@email.com"
  //to send to multiple emails   "to": ["email@email.com", "email2.email.com", "email3.email.com"]

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const recipients = to.toString().split(',');

 //send email
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
    db.query(
      `INSERT INTO notifications (email, subject, message, created_at)
      VALUES (?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))`,
      [recipients[i], subject, message],
      (error, results, fields) => {
        if (error) {
          console.error('Error inserting:', error.message);
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
app.get('/notification', (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  db.query('SELECT * FROM notifications', (error, rows) => {
    if (error) {
      console.error('Error retrieving notifications from database:', error.message);
      res.status(500).send('Error retrieving notifications');
    } else {
      res.status(200).json(rows);
    }
  });
});

// API endpoint to get all notification of a given user by email
app.get('/notification/:email', (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const email = req.params.email;

  // Retrieve notifications from the database that match the specified email
  db.query(`SELECT * FROM notifications WHERE email = ?`, [email], (error, results, fields) => {
    if (error) {
      console.error('Error retrieving notifications from database:', error.message);
      res.status(500).send('Error retrieving notifications');
    } else {
      // Set the necessary headers to allow cross-origin requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.status(200).json(results);
    }
  });
});

// API endpoint to delete a notification by ID
app.delete('/notification/delete/id/:id', (req, res) => {
  const id = parseInt(req.params.id);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Delete the notification from the database
  db.query(`DELETE FROM notifications WHERE id = ?`, id, (error, results, fields) => {
    if (error) {
      console.error('Error deleting notification from database:', error.message);
      res.status(500).send('Error deleting notification');
    } else if (results.affectedRows === 0) {
      res.status(404).send(`Notification with ID ${id} not found`);
    } else {
      res.status(200).send(`Notification with ID ${id} deleted successfully`);
    }
  });
});

// API endpoint to delete all notifications of a user by email
app.delete('/notification/delete/email/:email', (req, res) => {
  const email = req.params.email;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Delete the notifications from the database
  db.query(`DELETE FROM notifications WHERE email = ?`, email, (error, results, fields) => {
    if (error) {
      console.error('Error deleting notifications from database:', error.message);
      res.status(500).send('Error deleting notification');
    } else {
      res.status(200).send(`Notifications with email ${email} deleted successfully`);
    }
  });
});

// API endpoint to create a group
app.post('/group', async (req, res) => {
  const { name } = req.body;

  // Check if required fields are missing
  if (!name) {
    return res.status(400).send('Missing required fields');
  }

  db.query(
    `SELECT * FROM groupss WHERE name = ?`,
    [name],
    (error, results) => {
      if (error) {
        console.error('Error selecting:', error.message);
      } else if (results.length > 0) {
        console.log('Group already exists:', results[0]);
        return res.status(200).send('Group already exists');
      } else {
        db.query(
          `INSERT INTO groupss (name)
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

// API endpoint to delete a group
app.delete('/group/:id', (req, res) => {
  const id = req.params.id;

  // Remove all users associated with the group
  db.query(`DELETE FROM groupss_members WHERE group_id = ?`, [id], (error) => {
    if (error) {
      console.error('Error deleting group members from database:', error.message);
      res.status(500).send('Error deleting group members');
    } else {
      console.log('Group members deleted successfully');

      // Now delete the group itself
      db.query(`DELETE FROM groupss WHERE id = ?`, [id], (error, results) => {
        if (error) {
          console.error('Error deleting group from database:', error.message);
          res.status(500).send('Error deleting group');
        } else if (results.affectedRows === 0) {
          console.log('Group not found');
          res.status(404).send('Group not found');
        } else {
          console.log('Group deleted successfully');
          res.status(200).send('Group deleted successfully');
        }
      });
    }
  });
});

// API endpoint to add users to a group
app.put('/group/:id', (req, res) => {
  const groupId = req.params.id;
  const members = req.body.members;

  // Check if each member email already exists in the group for the given ID
  members.forEach(member => {
    db.query('SELECT COUNT(*) as count FROM groupss_members WHERE group_id = ? AND email = ?', [groupId, member], (err, rows) => {
      if (err) {
        console.error(err.message);
        res.send('Members already there');
      } else {
        // If the email does not exist in the group, add it to the table
        if (rows[0].count === 0) {
          db.query('INSERT INTO groupss_members (group_id, email) VALUES (?, ?)', [groupId, member], (err, rows) => {
            if (err) {
              console.error(err.message);
            }
          });
        }
      }
    });
  });

  res.send('Members added to group');
});

//API endpoint to get all users in each groupID
app.get('/group', (req, res) => {

  // Retrieve all group members from the database
  const query = "SELECT * FROM groupss_members";

  db.query(query, (error, results) => {
    if (error) {
      console.error('Error retrieving group members from database:', error.message);
      res.status(500).send('Error retrieving group members');
    } else {
      res.status(200).json(results);
    }
  });
});

//API endpoint to send notification to a group
app.post('/groupnotification', async (req, res) => {
  const { groupId, subject, message } = req.body;
  
  // Check if required fields are missing
  if (!groupId) {
    return res.status(400).send('Missing "groupId" parameter');
  }
  if (!subject) {
    return res.status(400).send('Missing "subject" parameter');
  }
  if (!message) {
    return res.status(400).send('Missing "message" parameter');
  }
  
  // Get the list of email addresses for the given group ID from the database
  const groupMembers = await new Promise((resolve, reject) => {
    db.query(`SELECT email FROM groupss_members WHERE group_id = ?`, [groupId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map(row => row.email));
      }
    });
  });

  // Send the email to each member of the group using SendGrid
  const msg = {
    to: groupMembers,
    from: 'eventfinderteste@gmail.com',
    templateId:'d-cc6ffeffa0f64ae6b2274f8a6fc5f390',
    dynamicTemplateData: {
      subject,
      text: message
    },
  };

  for (let i = 0; i < groupMembers.length; i++) {
    db.query(
      `INSERT INTO notifications (email, subject, message, created_at)
      VALUES (?, ?, ?, NOW())`,
      [groupMembers[i], subject, message],
      (error) => {
        if (error) {
          console.error('Error inserting:', error.message);
        } else {
          console.log('Inserted');
        }
      }
    );
  }

  try {
    await sgMail.send(msg);
    res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while sending the email');
  }
});




// API endpoint to get a group by name
app.get('/group/:name', (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const name = req.params.name;

  // Retrieve the group id from the database that matches the given name
  db.query(`SELECT id FROM groupss WHERE name = ?`, [name], (error, results) => {
    if (error) {
      console.error('Error retrieving group from database:', error.message);
      res.status(500).send('Error retrieving group');
    } else {
      if (results.length > 0) {
        res.status(200).json({ id: results[0].id });
      } else {
        res.status(404).send('Group not found');
      }
    }
  });
});

app.listen(3003, () => {
  console.log('App listening on port localhost:3003 !')
});
});