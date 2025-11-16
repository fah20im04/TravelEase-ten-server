require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const JWT_SECRET = process.env.JWT_SECRET;

let db, vehiclesCollection, usersCollection, bookingCollection;

async function connectDB() {
  try {
    const client = new MongoClient(uri, {
      serverApi: { version: ServerApiVersion.v1 },
      tls: true,
    });

    console.log("⏳ Connecting to MongoDB...");
    await client.connect();
    db = client.db(dbName);
    vehiclesCollection = db.collection("vehicles");
    usersCollection = db.collection("users");
    bookingCollection = db.collection("bookings");
    console.log("✅ Connected to MongoDB:", db.databaseName);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

connectDB();

app.use(cors());
app.use(express.json());

// ---------------- JWT MIDDLEWARE ----------------
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).send({ message: "Unauthorized: No token" });

  const token = authorization.split(" ")[1];
  if (!token) return res.status(401).send({ message: "Unauthorized: Missing token" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden: Invalid token" });
    req.token_email = decoded.email;
    next();
  });
};

// ---------------- USER ROUTES ----------------
app.post("/users", async (req, res) => {
  try {
    const newUser = req.body;
    const existingUser = await usersCollection.findOne({ email: newUser.email });
    if (existingUser) return res.status(200).send({ message: "User already exists" });

    await usersCollection.insertOne(newUser);
    res.status(201).send({ message: "User created successfully" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(401).send({ error: "User not found" });

    const token = jwt.sign({ email: user.email, id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    res.send({ token });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ---------------- VEHICLE ROUTES ----------------
app.get("/vehicles", async (req, res) => {
  try {
    const vehicles = await vehiclesCollection.find().sort({ createdAt: -1 }).limit(6).toArray();
    res.send(vehicles);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/vehicles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).send({ error: "Invalid vehicle ID" });

    const vehicle = await vehiclesCollection.findOne({ _id: new ObjectId(id) });
    if (!vehicle) return res.status(404).send({ message: "Vehicle not found" });

    res.send(vehicle);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post("/vehicles", verifyToken, async (req, res) => {
  try {
    const vehicle = { ...req.body, createdAt: new Date() };
    const result = await vehiclesCollection.insertOne(vehicle);
    res.status(201).send({ message: "Vehicle added successfully", insertedId: result.insertedId });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("TravelEase server running..."));

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
