import "reflect-metadata";
import { config } from "dotenv";
config();

import app from "./app.js";
import { env, validateEnv } from "../shared/config/env.js";
import { logger } from "../shared/utils/logger.js";

validateEnv();

app.listen(env.port, () => {
  logger.info(`OnCallShift API listening on :${env.port}`, {
    port: env.port,
    nodeEnv: env.nodeEnv,
  });
});
