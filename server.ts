import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import apiRouter from "./server/routes";
import authRouter from "./server/auth";
import { getLiveGlobalIndices } from "./server/apiClients";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = 3000;

// Register modular REST API endpoints
app.use(authRouter);
app.use(apiRouter);
app.get("/api/global-indices", async (req, res) => {
  try {
    const indices = await getLiveGlobalIndices();
    res.json({ indices });
  } catch (err: any) {
    console.error("[Global Indices] Endpoint error:", err);
    res.status(500).json({ error: "Failed to fetch global indices" });
  }
});
// Vite server configurations for handling assets and frontend hot builds
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lumina Quant Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
