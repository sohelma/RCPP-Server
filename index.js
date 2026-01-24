require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;
app.use("/uploads", express.static("uploads"));

// ----------------- MIDDLEWARES -----------------
app.use(express.json());
app.use(cors());

// ----------------- FILE UPLOAD -----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|jpg|jpeg|png|txt/;
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowedTypes.test(ext));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
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

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected successfully");

    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection("users");
    const reportIncidentCollection = db.collection("reportIncidentColl");
    const helpDeskCollection = db.collection("helpDeskColl");
    const newsCollection = db.collection("news");
    const commentsCollection = db.collection("comments");
    const alertCollection = db.collection("threatAlerts");
    const awarenessCollection = db.collection("awarenessContents");

    // =======News collection=======
    const newsRoutes = require("./routes/news");
    app.use("/api/news", newsRoutes(newsCollection, commentsCollection));

    //====Awareness Section=====
    const awarenessRoutes = require("./routes/awareness");
    app.use(
      "/api/awareness",
      awarenessRoutes(awarenessCollection, alertCollection),
    );

    // ----------------- AUTH ROUTES -----------------
    const createAuthRoutes = require("./routes/authRoutes");
    app.use("/auth", createAuthRoutes(usersCollection));
    /* ================= HELP DESK ================= */
    const createHelpDeskRoutes = require("./routes/helpDeskRoutes");
    app.use("/api", createHelpDeskRoutes(helpDeskCollection));

    // ADMIN-----------------------------------		// ADMIN-----------------------------------

    app.get("/admin-stats", async (req, res) => {
      try {
        const totalReports = await reportIncidentCollection.countDocuments();

        const pendingReview = await reportIncidentCollection.countDocuments({
          status: "pending",
        });

        const casesResolved = await reportIncidentCollection.countDocuments({
          status: "resolved",
        });

        const rejectedCases = await reportIncidentCollection.countDocuments({
          status: "rejected",
        });

        const criticalThreats = await reportIncidentCollection.countDocuments({
          urgency: "high",
        });

        // Threat distribution (example by incidentType)
        const distribution = await reportIncidentCollection
          .aggregate([
            {
              $group: {
                _id: "$incidentType",
                value: { $sum: 1 },
              },
            },
            {
              $project: {
                name: "$_id",
                value: 1,
                _id: 0,
              },
            },
          ])
          .toArray();

        res.send({
          success: true,
          summary: {
            totalReports,
            pendingReview,
            casesResolved,
            rejectedCases,
            criticalThreats,
          },
          distribution,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // ADMIN-----------------------------------		// ADMIN-----------------------------------

    // ----------------- USERS-START ---------------------------------- USERS-START ---------------------------------- USERS-START ---------------------------------- USERS-START -----------------
    // ********* SEARCH REPORT *********
    app.get("/report/:ticket", async (req, res) => {
      try {
        const ticket = req.params.ticket;
        const result = await reportIncidentCollection.findOne({
          ticketNumber: ticket,
        });
        if (result) {
          res.send(result);
        } else {
          res.status(404).json({ message: "Ticket Not Found" });
        }
      } catch (error) {
        res.status(500).json({ message: "Internal Server Problem" });
      }
    });
    // CREATE USER
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;

        if (!user.password || !user.email || !user.name) {
          return res.status(400).send({
            success: false,
            message: "Name, email and password are required",
          });
        }

        // Check if user already exists
        const existingUser = await usersCollection.findOne({
          email: user.email,
        });
        if (existingUser) {
          return res
            .status(400)
            .send({ success: false, message: "User already exists" });
        }

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
        const { q = "", page = 1, limit = 10 } = req.query;

        const pageNumber = parseInt(page);
        const pageSize = parseInt(limit);
        const skip = (pageNumber - 1) * pageSize;

        // Search query
        const query = q
          ? {
              $or: [
                { name: { $regex: q, $options: "i" } },
                { email: { $regex: q, $options: "i" } },
                { phone: { $regex: q, $options: "i" } },
              ],
            }
          : {};

        const users = await usersCollection
          .find(query)
          .skip(skip)
          .limit(pageSize)
          .toArray();

        const totalUsers = await usersCollection.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / pageSize);

        res.send({
          users,
          totalUsers,
          totalPages,
          currentPage: pageNumber,
        });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // UPDATE USER (FINAL)
    app.put("/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              name: updatedData.name,
              email: updatedData.email,
              phone: updatedData.phone,
              role: updatedData.role,
              status: updatedData.status,
              division: updatedData.division,
              district: updatedData.district,
              upazila: updatedData.upazila,
              updatedAt: new Date(),
            },
          },
        );

        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    //------------------------------------------------user-end----------------------------------//------------------------------------------------user-end----------------------------------//------------------------------------------------user-end----------------------------------

    // ----------------CASES---------------------CASES--------------------CASES--------------------CASES

    // GET CASES WITH SEARCH + PAGINATION
    app.get("/cases", async (req, res) => {
      try {
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

        res.send({
          cases,
          totalCases,
          totalPages,
          currentPage: pageNumber,
        });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });
    // GET SINGLE CASE DETAILS
    app.get("/cases/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const singleCase = await reportIncidentCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!singleCase) {
          return res
            .status(404)
            .send({ success: false, message: "Case not found" });
        }

        res.send({ success: true, data: singleCase });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // GET ASSIGNED CASES FOR USER
    // app.get("/users/:id/assigned-cases", async (req, res) => {
    //   try {
    //     const { id } = req.params;

    //     const cases = await reportIncidentCollection
    //       .find({ "assignedTo.userId": new ObjectId(id) })
    //       .sort({ assignedAt: -1 })
    //       .toArray();

    //     res.send({ success: true, data: cases });
    //   } catch (err) {
    //     res.status(500).send({ success: false, message: err.message });
    //   }
    // });
    // GET ASSIGNED CASES FOR USER
    app.get("/users/:id/assigned-cases", async (req, res) => {
      try {
        const { id } = req.params;

        const cases = await reportIncidentCollection
          .find({ "assignedTo.id": new ObjectId(id) }) // 🔥 FIX HERE
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
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required",
          });
        }

        const user = await usersCollection.findOne({
          _id: new ObjectId(userId),
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        const result = await reportIncidentCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              assignedTo: {
                id: user._id,
                name: user.name,
                email: user.email,
              },
              assignedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Case not found",
          });
        }

        res.send({
          success: true,
          message: "User assigned successfully",
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // ----------------- UPDATE CASE STATUS -----------------
    app.patch("/cases/:id/status", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["resolved", "rejected"].includes(status)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid status" });
        }

        const result = await reportIncidentCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Case not found" });
        }

        res.send({ success: true, message: "Status updated successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // -----------CASES-END------------CASES-END-----------------CASES-END--------------------CASES-END------------------CASES-END

    // PROFILE-------------------		// PROFILE-------------------// PROFILE-------------------// PROFILE-------------------// PROFILE-------------------// PROFILE-------------------// PROFILE-------------------// PROFILE-------------------
    // UPDATE PROFILE WITH IMAGE
    app.use("/uploads", express.static("uploads"));

    app.locals.usersCollection = usersCollection;

    const profileRoutes = require("./routes/userProfileRoutes");
    app.use(profileRoutes);

    // PROFILE-------------------// PROFILE-------------------// PROFILE-------------------// PROFILE-------------------// PROFILE-------------------// PROFILE-------------------

    // ----------------- REPORT INCIDENT -----------------
    app.post("/report-incident", async (req, res) => {
      try {
        const formData = req.body;
        const ticketNumber = `RCPP-${Math.floor(
          100000 + Math.random() * 900000,
        )}`;

        const newReport = {
          ...formData,
          ticketNumber: ticketNumber,
          status: "pending",
          submittedAt: new Date(),
        };

        const result = await reportIncidentCollection.insertOne(newReport);

        if (result.insertedId) {
          res.status(201).json({
            success: true,
            message: "Report submitted successfully",
            ticketNumber: ticketNumber,
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to save report to database",
          });
        }
      } catch (error) {
        console.error("Submission Error:", error);
        res.status(500).json({
          success: false,
          message: "Internal Server Error",
        });
      }
    });
    // ----------------- HELP DESK -----------------
  } catch (err) {
    console.error(err);
  }
}
//hello
run();

// ----------------- ROOT -----------------
app.get("/", (req, res) => res.send("RCPP main server is running"));

app.listen(port, () => console.log(`🚀 RCPP server running on port ${port}`));
