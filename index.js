// index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./DBconnection.js");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

connectDB().then((client) => {
  app.locals.dbClient = client; // store in app.locals if needed later
  app.listen(port, () => {
    console.log(`🚀 Server is running on port: ${port}`);
  });
});

app.get("/", (req, res) => {
  res.send("Hello from Agri Linker Server!");
});

// Start server only after DB connection
