require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;

const multer = require("multer");
const path = require("path");

// middlewares
app.use(express.json());
app.use(cors());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // folder where uploaded files will be stored
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|jpg|jpeg|png|txt/;
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

app.use("/uploads", express.static("uploads"));

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.byopfvf.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("RCPP_DB");
    const usersCollection = db.collection("users");
    const reportIncidentCollection = db.collection("reportIncidentColl");
    const helpDeskCollection = db.collection("helpDeskColl");

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.findOne(user);
      res.send(result);
    });

    // Report incident APIs
    app.post(
      "/report-incident",
      upload.array("evidence", 5), // max 5 files
      async (req, res) => {
        try {
          const {
            incidentType,
            urgentLevel,
            title,
            description,
            date,
            time,
            fullName,
            email,
            phone,
          } = req.body;

          const incidentData = {
            incidentType,
            urgentLevel,
            title,
            description,
            date,
            time,
            contactInfo: {
              fullName,
              email,
              phone: phone || null,
            },
            evidenceFiles:
              req.files?.map((file) => ({
                fileName: file.filename,
                filePath: file.path,
                fileType: file.mimetype,
              })) || [],
            createdAt: new Date().toLocaleString(),
          };

          const result = await reportIncidentCollection.insertOne(incidentData);
          res.status(201).send(result);
        } catch (error) {
          res.status(500).send({ message: error.message });
        }
      }
    );

    //Contact help-desk APIs
    app.post("/contact-helpdesk", async (req, res) => {
      try {
        const { name, email, technicalSupport, description } = req.body;

        //validation
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
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    //  GET all help desk requests (for admin)
    app.get("/contact-helpdesk", async (req, res) => {
      try {
        const requests = await helpDeskCollection.find().toArray();
        res.send(requests);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("RCPP main server is running");
});

app.listen(port, () => {
  console.log(`RCPP server is listening on port ${port}`);
});
