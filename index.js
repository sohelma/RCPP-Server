require("dotenv").config();
const express = require("express");
const cors = require("cors");

const path = require("path");
const bcrypt = require("bcryptjs");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
// Port will be handled by Vercel
app.use("/uploads", express.static("uploads"));

// ----------------- MIDDLEWARES -----------------
app.use(express.json());
app.use(cors());

// ----------------- FILE UPLOAD -----------------
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|jpg|jpeg|png|txt/;
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowedTypes.test(ext));
};
app.use("/uploads", express.static("uploads"));

// ----------------- MONGODB -----------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.byopfvf.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
let usersCollection;
let reportIncidentCollection;
let helpDeskCollection;
let newsCollection;
let commentsCollection;
let alertCollection;
let awarenessCollection;

// Lazy DB init for serverless
async function initDB() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.DB_NAME);
    usersCollection = db.collection("users");
    reportIncidentCollection = db.collection("reportIncidentColl");
    helpDeskCollection = db.collection("helpDeskColl");
    newsCollection = db.collection("news");
    commentsCollection = db.collection("comments");
    alertCollection = db.collection("threatAlerts");
    awarenessCollection = db.collection("awarenessContents");
    console.log("✅ MongoDB connected successfully");
  }
  return {
    db,
    usersCollection,
    reportIncidentCollection,
    helpDeskCollection,
    newsCollection,
    commentsCollection,
    alertCollection,
    awarenessCollection,
  };
}

// =======News collection=======
app.use("/api/news", async (req, res, next) => {
  const { newsCollection, commentsCollection } = await initDB();
  const newsRoutes = require("./routes/news");
  return newsRoutes(newsCollection, commentsCollection)(req, res, next);
});

//====Awareness Section=====
app.use("/api/awareness", async (req, res, next) => {
  const { awarenessCollection, alertCollection } = await initDB();
  const awarenessRoutes = require("./routes/awareness");
  return awarenessRoutes(awarenessCollection, alertCollection)(req, res, next);
});

// ----------------- AUTH ROUTES -----------------
app.use("/auth", async (req, res, next) => {
  const { usersCollection } = await initDB();
  const createAuthRoutes = require("./routes/authRoutes");
  return createAuthRoutes(usersCollection)(req, res, next);
});

/* ================= HELP DESK ================= */
app.use("/api", async (req, res, next) => {
  const { helpDeskCollection } = await initDB();
  const createHelpDeskRoutes = require("./routes/helpDeskRoutes");
  return createHelpDeskRoutes(helpDeskCollection)(req, res, next);
});

// ADMIN-----------------------------------
app.get("/admin-stats", async (req, res) => {
  try {
    const { reportIncidentCollection } = await initDB();
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
    res.status(500).send({ success: false, message: err.message });
  }
});

// ********* SEARCH REPORT *********
app.get("/report/:ticket", async (req, res) => {
  try {
    const { reportIncidentCollection } = await initDB();
    const ticket = req.params.ticket;
    const result = await reportIncidentCollection.findOne({ ticketNumber: ticket });
    if (result) res.send(result);
    else res.status(404).json({ message: "Ticket Not Found" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Problem" });
  }
});

// CREATE USER
app.post("/users", async (req, res) => {
  try {
    const { usersCollection } = await initDB();
    const user = req.body;

    if (!user.password || !user.email || !user.name) {
      return res.status(400).send({ success: false, message: "Name, email and password are required" });
    }

    const existingUser = await usersCollection.findOne({ email: user.email });
    if (existingUser) return res.status(400).send({ success: false, message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    user.role = user.role || "user";
    user.email_verified = true;

    const result = await usersCollection.insertOne(user);
    res.status(201).send({ success: true, data: result });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// GET USERS WITH SEARCH + PAGINATION
app.get("/users", async (req, res) => {
  try {
    const { usersCollection } = await initDB();
    const { q = "", page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    const query = q ? { $or: [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } }
    ] } : {};

    const users = await usersCollection.find(query).skip(skip).limit(pageSize).toArray();
    const totalUsers = await usersCollection.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / pageSize);

    res.send({ users, totalUsers, totalPages, currentPage: pageNumber });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// UPDATE USER
app.put("/users/:id", async (req, res) => {
  try {
    const { usersCollection } = await initDB();
    const { id } = req.params;
    const updatedData = req.body;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: {
        name: updatedData.name,
        email: updatedData.email,
        phone: updatedData.phone,
        role: updatedData.role,
        status: updatedData.status,
        division: updatedData.division,
        district: updatedData.district,
        upazila: updatedData.upazila,
        updatedAt: new Date(),
      }}
    );

    res.send({ success: true, result });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});
//------------------------------------------------user-end----------------------------------//------------------------------------------------user-end----------------------------------//------------------------------------------------user-end----------------------------------

// ----------------CASES---------------------CASES--------------------CASES--------------------CASES

// GET CASES WITH SEARCH + PAGINATION
app.get("/cases", async (req, res) => {
  try {
    const { reportIncidentCollection } = await initDB();
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

    const cases = await reportIncidentCollection
      .find(query)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();

    const totalCases = await reportIncidentCollection.countDocuments(query);
    const totalPages = Math.ceil(totalCases / pageSize);

    res.send({ cases, totalCases, totalPages, currentPage: pageNumber });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// GET SINGLE CASE DETAILS
app.get("/cases/:id", async (req, res) => {
  try {
    const { reportIncidentCollection } = await initDB();
    const { id } = req.params;
    const singleCase = await reportIncidentCollection.findOne({ _id: new ObjectId(id) });

    if (!singleCase) return res.status(404).send({ success: false, message: "Case not found" });
    res.send({ success: true, data: singleCase });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// GET ASSIGNED CASES FOR USER
app.get("/users/:id/assigned-cases", async (req, res) => {
  try {
    const { reportIncidentCollection } = await initDB();
    const { id } = req.params;
    const cases = await reportIncidentCollection
      .find({ "assignedTo.id": new ObjectId(id) })
      .sort({ assignedAt: -1 })
      .toArray();
    res.send({ success: true, data: cases });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// ASSIGN USER TO CASE
app.post("/cases/:id/assign", async (req, res) => {
  try {
    const { reportIncidentCollection, usersCollection } = await initDB();
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).send({ success: false, message: "User ID is required" });

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).send({ success: false, message: "User not found" });

    const result = await reportIncidentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { assignedTo: { id: user._id, name: user.name, email: user.email }, assignedAt: new Date() } }
    );

    if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Case not found" });

    res.send({ success: true, message: "User assigned successfully" });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// ----------------- UPDATE CASE STATUS -----------------
app.patch("/cases/:id/status", async (req, res) => {
  try {
    const { reportIncidentCollection } = await initDB();
    const { id } = req.params;
    const { status } = req.body;

    if (!["resolved", "rejected"].includes(status)) return res.status(400).send({ success: false, message: "Invalid status" });

    const result = await reportIncidentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Case not found" });

    res.send({ success: true, message: "Status updated successfully" });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// PROFILE ROUTES
app.use("/uploads", express.static("uploads"));
app.locals.usersCollection = usersCollection;

app.use(async (req, res, next) => {
  const { usersCollection } = await initDB();
  const profileRoutes = require("./routes/userProfileRoutes");
  return profileRoutes(req, res, next);
});

// ----------------- REPORT INCIDENT -----------------
app.post("/report-incident", async (req, res) => {
  try {
    const { reportIncidentCollection } = await initDB();
    const formData = req.body;
    const ticketNumber = `RCPP-${Math.floor(100000 + Math.random() * 900000)}`;

    const newReport = { ...formData, ticketNumber, status: "pending", submittedAt: new Date() };
    const result = await reportIncidentCollection.insertOne(newReport);

    if (result.insertedId) res.status(201).json({ success: true, message: "Report submitted successfully", ticketNumber });
    else res.status(500).json({ success: false, message: "Failed to save report to database" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ROOT
app.get("/", (req, res) => res.send("RCPP main server is running"));

// Run DB init at startup (optional)
// run().catch(err => console.error(err));

// Note: app.listen removed for Vercel serverless
