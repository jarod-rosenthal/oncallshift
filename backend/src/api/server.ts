import "reflect-metadata";
import { config } from "dotenv";
config();

import app from "./app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`[server] OnCallShift API listening on :${PORT}`);
});
