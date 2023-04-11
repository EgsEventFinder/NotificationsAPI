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
app.get('/notification', (req, res) => {

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
app.get('/notification/:email', (req, res) => {

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
      // Set the necessary headers to allow cross-origin requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.status(200).json(rows);
    }
  });
});

// API endpoint to delete a notification by ID
app.delete('/notification/remove/id/:id', (req, res) => {
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
app.delete('/notification/remove/email/:email', (req, res) => {
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
app.delete('/group/:id', (req, res) => {
  const id = req.params.id;

  db.run(`DELETE FROM groups WHERE id = ?`, [id], (error) => {
    if (error) {
      console.error('Error deleting group from database:', error.message);
      res.status(500).send('Error deleting group');
    } else {
      console.log('Group deleted successfully');
      // Remove all users associated with the group
      db.run(`DELETE FROM group_members WHERE group_id = ?`, [id], (error) => {
        if (error) {
          console.error('Error deleting group members from database:', error.message);
        } else {
          console.log('Group members deleted successfully');
        }
      });
      res.status(200).send('Group deleted successfully');
    }
  });
});

//API endpoint to add users to a group
app.put('/group/:id', (req, res) => {
  const groupId = req.params.id;
  const members = req.body.members;

  //usage "members" : ["mail@gmail.com"]
  // Check if each member email already exists in the group for the given ID
  db.serialize(() => {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND email = ?');
    members.forEach(member => {
      stmt.get(groupId, member, (err, row) => {
        if (err) {
          console.error(err.message);
          res.send('Members already there')
        } else {
          // If the email does not exist in the group, add it to the table
          if (row.count === 0) {
            const insertStmt = db.prepare('INSERT INTO group_members (group_id, email) VALUES (?, ?)');
            insertStmt.run(groupId, member);
            insertStmt.finalize();
          }
        }
      });
    });
    stmt.finalize();
  });

  res.send('Members added to group');
});

//API endpoint to get all users in each groupID
app.get('/group', (req, res) => {

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
    db.all(`SELECT email FROM group_members WHERE group_id = ?`, [groupId], (err, rows) => {
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
    db.run(
      `INSERT INTO notifications (email, subject, message, created_at)
      VALUES (?, ?, ?, datetime('now'))`,
      [groupMembers[i], subject, message],
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
    await sgMail.send(msg);
    res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while sending the email');
  }
});

// API endpoint to get a group by ID
app.get('/group/:name', (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const name = req.params.name;

  // Retrieve the group id from the database that matches the given name
  db.get(`SELECT id FROM groups WHERE name = ?`, [name], (error, row) => {
    if (error) {
      console.error('Error retrieving group from database:', error.message);
      res.status(500).send('Error retrieving group');
    } else {
      if (row) {
        res.status(200).json({ id: row.id });
      } else {
        res.status(404).send('Group not found');
      }
    }
  });
});

app.listen(3003, () => {
  console.log('App listening on port localhost:3003 !')
})