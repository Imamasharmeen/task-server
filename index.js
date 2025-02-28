const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { Server } = require("socket.io");
const http = require("http");
const { MongoClient, ServerApiVersion } = require("mongodb");

const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: [ "https://celadon-phoenix-51855d.netlify.app"],
    methods: ["GET", "POST"], 
    credentials: true, 
  },
});


app.use(
  cors({
    origin: ["https://celadon-phoenix-51855d.netlify.app"], 
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s6qv7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    

    const database = client.db("task-managementDB");
    const userCollection = database.collection("users");
    const taskCollection = database.collection("tasks");

  
    io.on("connection", (socket) => {
      console.log("🟢 A user connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("🔴 A user disconnected:", socket.id);
      });
    });


    app.post("/user", async (req, res) => {
      try {
        const { email, displayName } = req.body;
        if (!email || !displayName) return res.status(400).send({ message: "Missing email or display name" });

        const existingUser = await userCollection.findOne({ email });
        if (existingUser) return res.status(400).send({ message: "User already exists" });

        const result = await userCollection.insertOne(req.body);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    //  Add Task
    app.post("/tasks", async (req, res) => {
      try {
        const { title, category } = req.body;
        if (!title || !category) return res.status(400).send({ message: "Title and Category are required" });

        const newTask = { ...req.body, timestamp: new Date().toISOString() };
        const result = await taskCollection.insertOne(newTask);
        io.emit("taskAdded", newTask); // Send real-time update
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add task", error });
      }
    });

    //  Get All Tasks
    app.get("/tasks", async (req, res) => {
      try {
        const result = await taskCollection.find().toArray();
        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch tasks", error });
      }
    });

    //  Edit Task
    app.put("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid task ID" });

        const updatedTask = req.body;
        const result = await taskCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedTask });

        if (result.matchedCount === 0) return res.status(404).send({ message: "Task not found" });

        io.emit("taskUpdated", { id, updatedTask }); // Send real-time update
        res.status(200).send({ message: "Task updated successfully", result });
      } catch (error) {
        res.status(500).send({ message: "Failed to update task", error });
      }
    });

    //  Delete Task
    app.delete("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid task ID" });

        const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).send({ message: "Task not found" });

        io.emit("taskDeleted", id); // Send real-time update
        res.status(200).send({ message: "Task deleted successfully", result });
      } catch (error) {
        res.status(500).send({ message: "Failed to delete task", error });
      }
    });

    console.log(" Server is running!");
  } catch (error) {
    console.error(" MongoDB Connection Error:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => res.send("Hello Task Management"));

// ✅ Ensure the server listens properly
server.listen(port, () => {
  console.log(` Server running on port ${port}`);
});
