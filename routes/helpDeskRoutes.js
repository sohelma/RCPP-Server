const express = require("express");
const nodemailer = require("nodemailer");

module.exports = function (helpDeskCollection) {
  const router = express.Router();

  // ----------------- Nodemailer -----------------
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // Gmail App Password
    },
  });

  transporter.verify((err) => {
    if (err) {
      console.error("❌ Mail server error:", err);
    } else {
      console.log("✅ HelpDesk mail server ready");
    }
  });

  // ----------------- HELP DESK SUBMIT -----------------
  router.post("/contact-helpdesk", async (req, res) => {
    try {
      const { name, email, technicalSupport, description } = req.body;

      if (!name || !email || !technicalSupport || !description) {
        return res.status(400).send({
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

      // 1️⃣ Save to MongoDB
      await helpDeskCollection.insertOne(helpDeskData);

      // 2️⃣ Send Email
      await transporter.sendMail({
        from: `"RCPP Help Desk" <${process.env.SMTP_USER}>`,
        to: "sohelma.us@gmail.com",
        subject: `Help Desk Request: ${technicalSupport}`,
        text: `
          Name: ${name}
          Email: ${email}
          Issue Type: ${technicalSupport}

Description:
${description}
        `,
      });

      res.status(201).send({
        success: true,
        message: "Request submitted & email sent successfully",
      });
    } catch (err) {
      console.error("❌ HelpDesk error:", err);
      res.status(500).send({
        success: false,
        message: "Mail sending failed",
      });
    }
  });

  return router;
};
