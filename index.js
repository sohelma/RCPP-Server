require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const nodemailer = require("nodemailer");

const app = express();
const port = process.env.PORT || 5000;

// ----------------- MIDDLEWARES -----------------
app.use(express.json());
app.use(cors());

// ----------------- MONGODB -----------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.byopfvf.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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
          return res.status(400).json({
            success: false,
            message: "All fields are required",
          });
        }

        const helpDeskData = {
          name,
          email,
          technicalSupport,
          description,
          createdAt: new Date(),
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

  } catch (error) {
    console.error("❌ Server startup error:", error);
  }
}

// ----------------- ROOT -----------------
app.get("/", (req, res) => {
  res.send("✅ RCPP main server is running");
});

run();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
