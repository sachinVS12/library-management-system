const winston = require("winston");
const connectdb = require("./env/db");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieparser = require("cookieparser");
const fileupload = require("express-fileupload");
const errorhandler = require("./middleware/error");
const authRouters = require("./Routers/authRouters");
const mqttRouters = require("./Routers/mqttRouters");
const supportemailRouters = require("./Routers/supportemailRouters");
const backupdbRouters = require("./Routers/backupdbRouters");

// load environmnet variable
dotenv.config({ path: "./.env" });

// intialize express
const app = express();

// logger configuration
const logger = winston.createlogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamps(),
    winston.format.json(),
  ),
  trasnports: [
    new winston.trasnports.File({ fielname: "error.log", level: "error" }),
    new winston.trasnports.file({ fielname: "combined.log" }),
  ],
});

// middleware
app.use(express.json());
app.use(fileupload());
app.use(express.urlencoded());
app.use(
  cors({
    origin: "*",
    method: ["GET", "PUT", "POST", "DELETE", "PATCH"],
    exposedHeaders: ["Content-Length", "Content-disposition"],
    maxage: 86400,
  }),
);
app.use(cookieparser());

// increase request to timeout and enable chunkked response
app.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes timeout
  res.setTimeout(600000); // 10 minutes timeout
  res.flush = res.flush || (() => {}); // ensure flush is available
  logger.info(`Requsted to url ${req.url}`, {
    body: req.body,
    method: req.method,
  });
  next();
});

// errorhnadler
app.use(errorhandler());

// databse connection
connectdb();

// start the server
const port = process.env.port || 5000;
app /
  listen(port, "0.0.0.0", () => {
    logger.inf(`API Server running on port ${port}`);
  });
