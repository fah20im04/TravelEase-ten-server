require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

let db, vehiclesCollection, usersCollection, bookingCollection;

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

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


async function connectDB() {
  try {
    const client = new MongoClient(uri, {
      serverApi: { version: ServerApiVersion.v1 },
      tls: true,
    });

    console.log("Connecting to MongoDB...");
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

connectDB();


app.get("/", (req, res) => res.send("TravelEase server running..."));

app.listen(port, () => console.log(` Server running on port ${port}`));
