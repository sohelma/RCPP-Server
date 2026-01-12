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
    const threatCollection = db.collection("threatAlerts");
    const safetyGuidesCollection = db.collection("safetyGuides");
    const infographicCollection = db.collection("infographic");
    const videosCollection = db.collection("videos");
    const blogPostsCollection = db.collection("blogPosts");
    const featuredContentCollection = db.collection("featuredContent");

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

    // awareness page APIs
    // Threat-alerts
    app.post("/threat-alerts", async (req, res) => {
      try {
        const threatAlerts = req.body;

        // validate: must be an array
        if (!Array.isArray(threatAlerts)) {
          return res.status(400).json({ message: "Data must be an array" });
        }

        const result = await threatCollection.insertMany(threatAlerts);

        res.status(201).json({
          message: "Threat alerts inserted successfully",
          insertedCount: result.insertedCount,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to insert threat alerts" });
      }
    });

    app.get("/threat-alerts", async (req, res) => {
      try {
        const alerts = await threatCollection.find({}).toArray();

        res.status(200).json(alerts);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch threat alerts" });
      }
    });

    // safety guides API
    app.post("/safety-guides", async (req, res) => {
      try {
        const guides = req.body;

        // validation
        if (!Array.isArray(guides)) {
          return res.status(400).json({
            message: "Data must be an array",
          });
        }

        const result = await safetyGuidesCollection.insertMany(guides);

        res.status(201).json({
          message: "Safety guides inserted successfully",
          insertedCount: result.insertedCount,
        });
      } catch (error) {
        console.error("INSERT ERROR 👉", error);
        res.status(500).json({
          message: "Failed to insert safety guides",
          error: error.message,
        });
      }
    });

    app.get("/safety-guides", async (req, res) => {
      try {
        const guides = await safetyGuidesCollection.find({}).toArray();
        res.status(200).json(guides);
      } catch (error) {
        res.status(500).json({
          message: "Failed to fetch safety guides",
        });
      }
    });

    // infographic APIs
    app.post("/infographics", async (req, res) => {
      try {
        const infographics = req.body;

        // Validate that body is an array
        if (!Array.isArray(infographics)) {
          return res.status(400).json({
            message: "Data must be an array",
          });
        }

        const insertedIds = [];

        // Loop through each infographic and insert individually
        for (const info of infographics) {
          const result = await infographicCollection.insertOne(info);
          insertedIds.push(result.insertedId);
        }

        res.status(201).json({
          message: "Infographics inserted successfully",
          insertedCount: insertedIds.length,
          insertedIds,
        });
      } catch (error) {
        console.error("INSERT ERROR 👉", error);
        res.status(500).json({
          message: "Failed to insert infographics",
          error: error.message,
        });
      }
    });
    app.get("/infographics", async (req, res) => {
      try {
        const infographics = await infographicCollection.find({}).toArray();

        res.status(200).json(infographics);
      } catch (error) {
        console.error("FETCH ERROR 👉", error);
        res.status(500).json({
          message: "Failed to fetch infographics",
          error: error.message,
        });
      }
    });

    // videos APIs
    // POST /videos
    app.post("/videos", async (req, res) => {
      try {
        const video = req.body;

        // Validate: must be an object with a title
        if (!video || !video.title) {
          return res.status(400).json({
            message: "Video data is required with a title",
          });
        }

        const result = await videosCollection.insertOne(video);

        res.status(201).json({
          message: "Video inserted successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("INSERT VIDEO ERROR 👉", error);
        res.status(500).json({
          message: "Failed to insert video",
          error: error.message,
        });
      }
    });

    // GET /videos
    app.get("/videos", async (req, res) => {
      try {
        const videos = await videosCollection.find({}).toArray();
        res.status(200).json(videos);
      } catch (error) {
        console.error("FETCH VIDEOS ERROR 👉", error);
        res.status(500).json({
          message: "Failed to fetch videos",
          error: error.message,
        });
      }
    });

    // POST /blogs
    app.post("/blogs", async (req, res) => {
      try {
        const blogs = req.body;

        // validation
        if (!Array.isArray(blogs)) {
          return res.status(400).json({
            message: "Data must be an array",
          });
        }

        const result = await blogPostsCollection.insertMany(blogs);

        res.status(201).json({
          message: "Blog posts inserted successfully",
          insertedCount: result.insertedCount,
        });
      } catch (error) {
        console.error("INSERT BLOG ERROR 👉", error);
        res.status(500).json({
          message: "Failed to insert blog posts",
          error: error.message,
        });
      }
    });

    // GET /blogs
    app.get("/blogs", async (req, res) => {
      try {
        const blogs = await blogPostsCollection.find({}).toArray();
        res.status(200).json(blogs);
      } catch (error) {
        console.error("FETCH BLOG ERROR 👉", error);
        res.status(500).json({
          message: "Failed to fetch blog posts",
          error: error.message,
        });
      }
    });

    // POST /featured-content
    app.post("/featured-content", async (req, res) => {
      try {
        const featuredItems = req.body;

        // validation
        if (!Array.isArray(featuredItems)) {
          return res.status(400).json({
            message: "Data must be an array",
          });
        }

        const result = await featuredContentCollection.insertMany(
          featuredItems
        );

        res.status(201).json({
          message: "Featured content inserted successfully",
          insertedCount: result.insertedCount,
        });
      } catch (error) {
        console.error("INSERT FEATURED ERROR 👉", error);
        res.status(500).json({
          message: "Failed to insert featured content",
          error: error.message,
        });
      }
    });

    // GET /featured-content
    app.get("/featured-content", async (req, res) => {
      try {
        const featured = await featuredContentCollection.find({}).toArray();
        res.status(200).json(featured);
      } catch (error) {
        console.error("FETCH FEATURED ERROR 👉", error);
        res.status(500).json({
          message: "Failed to fetch featured content",
          error: error.message,
        });
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
