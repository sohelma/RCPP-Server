require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
// const { MongoClient, ServerApiVersion } = require("mongodb");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

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
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// ----------------- NODEMAILER -----------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password
  },
});

// ----------------- MAIN RUN -----------------
async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db(process.env.DB_NAME);
    const helpDeskCollection = db.collection("helpDeskColl");

    // ----------------- HELP DESK API -----------------
    app.post("/contact-helpdesk", async (req, res) => {
      try {
        const { name, email, technicalSupport, description } = req.body;
        if (!name || !email || !technicalSupport || !description) {
          return res.status(400).send({ message: "All fields are required" });
        }

        const helpDeskData = {
          name,
          email,
          technicalSupport,
          description,
          createdAt: new Date().toLocaleString(),
        };

        // 1️⃣ Save to DB
        await helpDeskCollection.insertOne(helpDeskData);

        // 2️⃣ Send single email (ONLY ONCE)
        await transporter.sendMail({
          from: `"RCPP Help Desk" <${process.env.SMTP_USER}>`,
          to: process.env.SMTP_USER,
          subject: `New Help Desk Request — ${technicalSupport}`,
          text: `
              Name: ${name}
              Email: ${email}
              Issue Type: ${technicalSupport}
              Description:
              ${description}
          `,
        });

        return res.status(201).json({
          success: true,
          message: "Request submitted successfully",
        });

      } catch (error) {
        console.error("❌ Help desk error:", error);
        return res.status(500).json({
          success: false,
          message: "Server error. Please try again later.",
        });
      }
    });
  } catch (err) {
    console.error(err);
  }
}

run();

// ----------------- ROOT -----------------
app.get("/", (req, res) => {
  res.send("✅ RCPP main server is running");
});

run();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
