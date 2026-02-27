import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const app = express();

/* =========================
   🔐 CONFIAR EN PROXY (IP REAL)
========================= */
app.set("trust proxy", true);

/* =========================
   MIDDLEWARES
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* =========================
   🔌 CONEXIÓN NEON POSTGRES
========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================
   TEST DE CONEXIÓN
========================= */
app.get("/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT NOW()");
    res.json({ ok: true, time: rows[0].now });
  } catch (err) {
    console.error("❌ Error conexión Neon:", err.message);
    res.status(500).json({ error: "Neon no conecta" });
  }
});

/* =========================
   OBTENER ÚLTIMO POST
========================= */
app.get("/posts/latest", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, content
      FROM posts
      WHERE content IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No hay posts" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error obteniendo último post:", err);
    res.status(500).json({ error: "Error cargando post" });
  }
});

/* =========================
   SIGUIENTE POST NO RESPONDIDO
========================= */
app.get("/posts/next/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT p.id, p.content
      FROM posts p
      WHERE p.content IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM post_publication_survey s
        WHERE s.post_id = p.id
        AND s.user_id = $1
      )
      ORDER BY p.created_at ASC
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({ done: true });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error obteniendo siguiente post:", err);
    res.status(500).json({ error: "Error obteniendo post" });
  }
});

/* =========================
   GUARDAR RESPUESTA + IP + UA
========================= */
app.post("/survey", async (req, res) => {
  const { post_id, user_id, published_by_user } = req.body;

  if (!post_id || !user_id || published_by_user === undefined) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.ip ||
    req.socket.remoteAddress;

  const userAgent = req.headers["user-agent"] || "desconocido";

  try {
    await pool.query(
      `
      INSERT INTO post_publication_survey
      (post_id, user_id, published_by_user, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (post_id, user_id) DO NOTHING
      `,
      [post_id, user_id, published_by_user, ip, userAgent]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error guardando encuesta:", err);
    res.status(500).json({ error: "Error guardando encuesta" });
  }
});

/* =========================
   PANEL ADMIN (OPCIONAL)
========================= */
app.get("/admin/responses", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.content AS post,
        s.published_by_user,
        s.ip_address,
        s.user_agent,
        s.user_id,
        s.created_at
      FROM post_publication_survey s
      JOIN posts p ON p.id = s.post_id
      ORDER BY s.created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("❌ Error admin:", err);
    res.status(500).json({ error: "Error cargando respuestas" });
  }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});