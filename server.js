require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // <-- sirve el index.html

// =========================
// CLOUDINARY CONFIG
// =========================
cloudinary.config({
  secure: true,
});

// =========================
// MULTER CONFIG
// =========================
const upload = multer({ dest: "uploads/" });

// =========================
// NEON CONNECTION
// =========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// =========================
// TEST DB
// =========================
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      mensaje: "Conectado 🚀",
      hora: result.rows[0].now,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error DB" });
  }
});

// =========================
// CREAR POST
// =========================
app.post("/posts", async (req, res) => {
  const { content } = req.body;

  if (!content) return res.status(400).json({ error: "Contenido requerido" });

  try {
    const result = await pool.query(
      "INSERT INTO posts (content) VALUES ($1) RETURNING *",
      [content]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando post" });
  }
});

// =========================
// OBTENER POSTS
// =========================
app.get("/posts", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM posts ORDER BY created_at DESC"
  );
  res.json(result.rows);
});

// =========================
// SUBIR IMAGEN
// =========================
app.post("/upload-image", upload.single("image"), async (req, res) => {
  const { post_id } = req.body;

  if (!req.file)
    return res.status(400).json({ error: "No se envió imagen" });

  try {
    const uploadResult = await cloudinary.uploader.upload(req.file.path);

    fs.unlinkSync(req.file.path);

    const dbResult = await pool.query(
      "INSERT INTO images (post_id, image_url, public_id) VALUES ($1, $2, $3) RETURNING *",
      [post_id, uploadResult.secure_url, uploadResult.public_id]
    );

    res.json(dbResult.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error subiendo imagen" });
  }
});

// =========================
// OBTENER IMAGENES
// =========================
app.get("/images/:postId", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM images WHERE post_id = $1",
    [req.params.postId]
  );
  res.json(result.rows);
});

// =========================
// CREAR COMENTARIO
// =========================
app.post("/comments", async (req, res) => {
  const { post_id, content } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO comments (post_id, content) VALUES ($1, $2) RETURNING *",
      [post_id, content]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error creando comentario" });
  }
});

// =========================
// OBTENER COMENTARIOS
// =========================
app.get("/comments/:postId", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC",
    [req.params.postId]
  );
  res.json(result.rows);
});

// =========================
// REACCIONAR
// =========================
app.post("/reactions", async (req, res) => {
  const { post_id, emoji } = req.body;

  const existing = await pool.query(
    "SELECT * FROM reactions WHERE post_id = $1 AND emoji = $2",
    [post_id, emoji]
  );

  if (existing.rows.length > 0) {
    const updated = await pool.query(
      "UPDATE reactions SET count = count + 1 WHERE post_id = $1 AND emoji = $2 RETURNING *",
      [post_id, emoji]
    );
    return res.json(updated.rows[0]);
  } else {
    const created = await pool.query(
      "INSERT INTO reactions (post_id, emoji, count) VALUES ($1, $2, 1) RETURNING *",
      [post_id, emoji]
    );
    return res.json(created.rows[0]);
  }
});

// =========================
// OBTENER REACCIONES
// =========================
app.get("/reactions/:postId", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM reactions WHERE post_id = $1",
    [req.params.postId]
  );
  res.json(result.rows);
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});