// index.js - Part 1

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

// ----------------- MIDDLEWARES -----------------
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

// ----------------- FILE UPLOAD -----------------
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|jpg|jpeg|png|txt/;
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowedTypes.test(ext));
};

// ----------------- MONGODB SERVERLESS READY -----------------
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.byopfvf.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  const db = client.db(process.env.DB_NAME);

  cachedClient = client;
  cachedDb = db;

  console.log("✅ MongoDB connected successfully");

  return { client, db };
}

// ----------------- ROOT -----------------
app.get("/", (req, res) => {
  res.send("RCPP main server is running 🚀");
});

module.exports = app;
// index.js - Part 2 (continue from Part 1)

const createAuthRoutes = require("./routes/authRoutes");
const createHelpDeskRoutes = require("./routes/helpDeskRoutes");
const newsRoutes = require("./routes/news");
const awarenessRoutes = require("./routes/awareness");

// ----------------- USERS & AUTH -----------------
app.post("/users", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("users");

    const user = req.body;

    if (!user.password || !user.email || !user.name) {
      return res.status(400).send({
        success: false,
        message: "Name, email and password are required",
      });
    }

    // Check if user exists
    const existingUser = await usersCollection.findOne({ email: user.email });
    if (existingUser) {
      return res.status(400).send({ success: false, message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    user.role = user.role || "user";
    user.email_verified = true;

    const result = await usersCollection.insertOne(user);
    res.status(201).send({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

app.get("/users", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("users");

    const { q = "", page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    const query = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { phone: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const users = await usersCollection.find(query).skip(skip).limit(pageSize).toArray();
    const totalUsers = await usersCollection.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / pageSize);

    res.send({
      users,
      totalUsers,
      totalPages,
      currentPage: pageNumber,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// ----------------- AUTH ROUTES -----------------
app.use("/auth", async (req, res, next) => {
  const { db } = await connectToDatabase();
  const usersCollection = db.collection("users");
  createAuthRoutes(usersCollection)(req, res, next);
});

// ----------------- HELP DESK ROUTES -----------------
app.use("/api", async (req, res, next) => {
  const { db } = await connectToDatabase();
  const helpDeskCollection = db.collection("helpDeskColl");
  createHelpDeskRoutes(helpDeskCollection)(req, res, next);
});

// ----------------- NEWS ROUTES -----------------
app.use("/api/news", async (req, res, next) => {
  const { db } = await connectToDatabase();
  const newsCollection = db.collection("news");
  const commentsCollection = db.collection("comments");
  newsRoutes(newsCollection, commentsCollection)(req, res, next);
});

// ----------------- AWARENESS ROUTES -----------------
app.use("/api/awareness", async (req, res, next) => {
  const { db } = await connectToDatabase();
  const awarenessCollection = db.collection("awarenessContents");
  const alertCollection = db.collection("threatAlerts");
  awarenessRoutes(awarenessCollection, alertCollection)(req, res, next);
});
// index.js - Part 3 (continue from Part 2)

// ----------------- ADMIN STATS -----------------
app.get("/admin-stats", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const reportIncidentCollection = db.collection("reportIncidentColl");

    const totalReports = await reportIncidentCollection.countDocuments();
    const pendingReview = await reportIncidentCollection.countDocuments({ status: "pending" });
    const casesResolved = await reportIncidentCollection.countDocuments({ status: "resolved" });
    const rejectedCases = await reportIncidentCollection.countDocuments({ status: "rejected" });
    const criticalThreats = await reportIncidentCollection.countDocuments({ urgency: "high" });

    const distribution = await reportIncidentCollection
      .aggregate([
        { $group: { _id: "$incidentType", value: { $sum: 1 } } },
        { $project: { name: "$_id", value: 1, _id: 0 } },
      ])
      .toArray();

    res.send({
      success: true,
      summary: { totalReports, pendingReview, casesResolved, rejectedCases, criticalThreats },
      distribution,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// ----------------- REPORT INCIDENT -----------------
app.post("/report-incident", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const reportIncidentCollection = db.collection("reportIncidentColl");

    const formData = req.body;
    const ticketNumber = `RCPP-${Math.floor(100000 + Math.random() * 900000)}`;

    const newReport = { ...formData, ticketNumber, status: "pending", submittedAt: new Date() };
    const result = await reportIncidentCollection.insertOne(newReport);

    if (result.insertedId) {
      res.status(201).json({ success: true, message: "Report submitted successfully", ticketNumber });
    } else {
      res.status(500).json({ success: false, message: "Failed to save report to database" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------- CASES -----------------
app.get("/cases", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const reportIncidentCollection = db.collection("reportIncidentColl");

    const { q = "", page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    const query = q
      ? {
          $or: [
            { title: { $regex: q, $options: "i" } },
            { "contactInfo.fullName": { $regex: q, $options: "i" } },
            { incidentType: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const cases = await reportIncidentCollection.find(query).sort({ _id: -1 }).skip(skip).limit(pageSize).toArray();
    const totalCases = await reportIncidentCollection.countDocuments(query);
    const totalPages = Math.ceil(totalCases / pageSize);

    res.send({ cases, totalCases, totalPages, currentPage: pageNumber });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// GET SINGLE CASE
app.get("/cases/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const reportIncidentCollection = db.collection("reportIncidentColl");

    const singleCase = await reportIncidentCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!singleCase) return res.status(404).send({ success: false, message: "Case not found" });

    res.send({ success: true, data: singleCase });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// ASSIGN USER TO CASE
app.post("/cases/:id/assign", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const reportIncidentCollection = db.collection("reportIncidentColl");
    const usersCollection = db.collection("users");

    const { userId } = req.body;
    if (!userId) return res.status(400).send({ success: false, message: "User ID is required" });

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).send({ success: false, message: "User not found" });

    const result = await reportIncidentCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { assignedTo: { id: user._id, name: user.name, email: user.email }, assignedAt: new Date() } }
    );

    if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Case not found" });

    res.send({ success: true, message: "User assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// UPDATE CASE STATUS
app.patch("/cases/:id/status", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const reportIncidentCollection = db.collection("reportIncidentColl");

    const { status } = req.body;
    if (!["resolved", "rejected"].includes(status)) {
      return res.status(400).send({ success: false, message: "Invalid status" });
    }

    const result = await reportIncidentCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Case not found" });

    res.send({ success: true, message: "Status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});
// index.js - Part 4 (continue from Part 3)

// ----------------- USER PROFILE -----------------
const userProfileRoutes = require("./routes/userProfileRoutes");
app.use("/profile", async (req, res, next) => {
  const { db } = await connectToDatabase();
  const usersCollection = db.collection("users");
  userProfileRoutes(usersCollection)(req, res, next);
});

// ----------------- GET ASSIGNED CASES FOR USER -----------------
app.get("/users/:id/assigned-cases", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const reportIncidentCollection = db.collection("reportIncidentColl");

    const { id } = req.params;
    const cases = await reportIncidentCollection
      .find({ "assignedTo.id": new ObjectId(id) })
      .sort({ assignedAt: -1 })
      .toArray();

    res.send({ success: true, data: cases });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// ----------------- FILE UPLOAD -----------------
app.use("/uploads", express.static("uploads"));

const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage, fileFilter });

// Example route to upload file
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).send({ success: false, message: "No file uploaded" });

    res.send({ success: true, filename: req.file.filename, path: req.file.path });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// ----------------- ROOT ROUTE -----------------
app.get("/", (req, res) => res.send("🚀 RCPP main server is running"));

// ----------------- SERVER EXPORT -----------------
// For serverless deployment (Vercel)
module.exports = app;
