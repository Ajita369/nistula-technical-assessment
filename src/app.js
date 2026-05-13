const express = require("express");
const webhookRouter = require("./routes/webhook");
const { notFoundHandler, errorHandler } = require("./utils/errorHandlers");

const app = express();

app.use(express.json({ limit: "64kb" }));
app.use("/webhook", webhookRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
