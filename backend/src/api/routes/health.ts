import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/version", (_req, res) => {
  res.json({
    version: process.env.npm_package_version || "0.1.0",
    node: process.version,
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
