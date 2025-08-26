const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./DBconnection.js");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Start server only after DB connection
connectDB().then((client) => {
  // keep the collections here
  const userCollection = client.db("AgriLinker").collection("users");

  app.get("/users", async (req, res) => {
    try {
      const users = await userCollection.find().toArray();
      res.json(users);
      console.log("✅ /users route called");
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/", (req, res) => {
    res.send("Hello from Agri Linker Server!");
  });

  app.listen(port, () => {
    console.log(`🚀 Server is running on port: ${port}`);
  });
});
