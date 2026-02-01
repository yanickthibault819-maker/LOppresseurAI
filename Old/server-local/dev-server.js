import express from "express";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), "server-local", ".env") });

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

import health from "../api/health.js";
import test from "../api/providers-test.js";
import models from "../api/providers-models.js";
import cache from "../api/providers-cache.js";
import generate from "../api/generate.js";

app.all("/api/health", (req,res)=>health(req,res));
app.all("/api/providers/test", (req,res)=>test(req,res));
app.all("/api/providers/models", (req,res)=>models(req,res));
app.all("/api/providers/cache", (req,res)=>cache(req,res));
app.all("/api/generate", (req,res)=>generate(req,res));

app.get("*", (req,res)=>res.sendFile(path.join(process.cwd(), "public", "index.html")));

const PORT = process.env.PORT || 8787;
app.listen(PORT, ()=>console.log(`Local dev: http://localhost:${PORT}`));
