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

const allowedOrigins = [
  'http://localhost:5173',          // local dev frontend
  'https://your-frontend.vercel.app', // production frontend
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow Postman, server-to-server
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // required if frontend sends cookies
}));


app.use(express.json());

// ---------------- JWT MIDDLEWARE ----------------
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization)
    return res.status(401).send({ message: "Unauthorized: No token" });

  const token = authorization.split(" ")[1];
  if (!token)
    return res.status(401).send({ message: "Unauthorized: Missing token" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(403).send({ message: "Forbidden: Invalid token" });
    req.token_email = decoded.email;
    next();
  });
};

// ---------------- ROOT ROUTE ----------------
app.get("/", (req, res) => res.send("TravelEase server running..."));

// ---------------- DATABASE CONNECTION ----------------
let db, vehiclesCollection, usersCollection, bookingCollection;

async function connectDB() {
  try {
    const client = new MongoClient(uri, {
      serverApi: { version: ServerApiVersion.v1 },
      tls: true,
      connectTimeoutMS: 10000,
    });

    console.log(" Connecting to MongoDB...");
    await client.connect();
    db = client.db(dbName);
    vehiclesCollection = db.collection("vehicles");
    usersCollection = db.collection("users");
    bookingCollection = db.collection("bookings");
    console.log(" Connected to MongoDB:", db.databaseName);
  } catch (err) {
    console.error(" MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

// ---------------- USERS ROUTES ----------------

// Create user or verify existence
app.post("/users", async (req, res) => {
  try {
    const newUser = req.body;
    const existingUser = await usersCollection.findOne({
      email: newUser.email,
    });
    if (existingUser) {
      return res
        .status(200)
        .send({ message: "User already exists", user: existingUser });
    }

    const result = await usersCollection.insertOne(newUser);
    res
      .status(201)
      .send({
        message: "User created successfully",
        user: { ...newUser, _id: result.insertedId },
      });
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

// Login user and issue JWT
app.post("/login", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(401).send({ error: "User not found" });

    const token = jwt.sign({ email: user.email, id: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.send({ message: "Login successful", token, user });
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

// ---------------- VEHICLES ROUTES ----------------
app.get("/vehicles", async (req, res) => {
  try {
    const vehicles = await vehiclesCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.send(vehicles);
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

app.get("/vehicles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ error: "Invalid vehicle ID" });

    const vehicle = await vehiclesCollection.findOne({ _id: new ObjectId(id) });
    if (!vehicle) return res.status(404).send({ message: "Vehicle not found" });

    res.send(vehicle);
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

app.get("/allVehicles", verifyToken, async (req, res) => {
  try {
    const allVehicles = await vehiclesCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.send(allVehicles);
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

app.post("/vehicles", verifyToken, async (req, res) => {
  try {
    const vehicle = { ...req.body, createdAt: new Date() };
    const result = await vehiclesCollection.insertOne(vehicle);
    res.status(201).send({
      message: "Vehicle added successfully",
      insertedId: result.insertedId,
    });
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

app.delete("/vehicles/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ error: "Invalid vehicle ID" });

    const result = await vehiclesCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0)
      return res.status(404).send({ error: "Vehicle not found" });

    res.send({ message: "Vehicle deleted successfully" });
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

// ---------------- BOOKINGS ROUTES ----------------
app.get("/bookings", verifyToken, async (req, res) => {
  try {
    const email = req.token_email;
    const bookings = await bookingCollection
      .find({ userEmail: email })
      .toArray();
    res.send(bookings);
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

app.post("/bookings", verifyToken, async (req, res) => {
  try {
    const booking = req.body;
    if (booking.userEmail !== req.token_email)
      return res
        .status(403)
        .send({ message: "Forbidden: Cannot book for another user" });

    const existing = await bookingCollection.findOne({
      vehicleId: booking.vehicleId,
    });
    if (existing)
      return res.status(400).send({ error: "Vehicle already booked" });

    const result = await bookingCollection.insertOne(booking);
    res.send({
      message: "Booking saved successfully",
      bookingId: result.insertedId,
    });
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

// Update vehicle
app.put("/vehicles/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ error: "Invalid vehicle ID" });

    const updatedData = { ...req.body };
    // Optional: prevent userEmail override
    delete updatedData.userEmail;

    const result = await vehiclesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0)
      return res.status(404).send({ error: "Vehicle not found" });

    res.send({ message: "Vehicle updated successfully" });
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

app.delete("/bookings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ error: "Invalid booking ID" });

    const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0)
      return res.status(404).send({ error: "Booking not found" });

    res.send({ message: "Booking canceled successfully" });
  } catch (err) {
    res.status(500).send({ error: "Server error", details: err.message });
  }
});

// ---------------- START SERVER ----------------
connectDB().then(() => {
  app.listen(port, () => console.log(`Server running on port ${port}`));
});
