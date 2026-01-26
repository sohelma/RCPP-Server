
const path = require("path");


const fileFilter = (req, file, cb) => {
  const allowed = /jpg|jpeg|png/;
  cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
};

