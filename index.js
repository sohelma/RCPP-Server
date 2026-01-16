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
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected successfully");

    const db = client.db(process.env.DB_NAME);
    const helpDeskCollection = db.collection("helpDeskColl");

 // ----------------- Nodemailer -----------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password
  },
});


    // ---------- TEST MAIL ----------
    app.get("/test-mail", async (req, res) => {
      try {
        await transporter.sendMail({
          from: `"Test Mail" <${process.env.SMTP_USER}>`,
          to: process.env.SMTP_USER,
          subject: "Test Email",
          text: "If you received this mail, nodemailer works!",
        });
        res.send("✅ Test mail sent successfully");
      } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
      }
    });

    // ----------------- HELP DESK -----------------
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

        const result = await helpDeskCollection.insertOne(helpDeskData);

        await transporter.sendMail({
          from: `"Help Desk" <${process.env.SMTP_USER}>`,
          to: "sohelma.us@gmail.com",
          subject: `New Help Desk Request from ${name}`,
          text: `
            Name: ${name}
            Email: ${email}
            Type: ${technicalSupport}
            Description: ${description}
            Submitted At: ${helpDeskData.createdAt}
          `,
        });

        res.status(201).send({
          success: true,
          message: "Request submitted and email sent to support team.",
          data: result,
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });
  } catch (err) {
    console.error(err);
  }
}

// ----------------- ROOT -----------------
app.get("/", (req, res) => res.send("RCPP main server is running"));

run();

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
