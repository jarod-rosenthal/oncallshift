import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import healthRouter from "./routes/health.js";

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(",") || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// Routes
app.use("/", healthRouter);

export default app;
