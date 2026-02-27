const postContent = document.getElementById("postContent");
const mensaje = document.getElementById("mensaje");

// Usuario temporal (luego puedes cambiarlo por login real)
const userId =
  localStorage.getItem("survey_user_id") ||
  crypto.randomUUID();

localStorage.setItem("survey_user_id", userId);

let currentPostId = null;

/* =========================
   CARGAR SIGUIENTE POST
========================= */
function cargarPost() {
  fetch(`/posts/next/${userId}`)
    .then(res => res.json())
    .then(data => {
      if (data.done) {
        postContent.textContent = "🎉 Ya respondiste todos los posts";
        mensaje.textContent = "";
        return;
      }

      currentPostId = data.id;
      postContent.textContent = data.content;
      mensaje.textContent = "";
    })
    .catch(() => {
      postContent.textContent = "❌ Error cargando post";
    });
}

/* =========================
   RESPONDER
========================= */
function responder(valor) {
  if (!currentPostId) return;

  fetch("/survey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      post_id: currentPostId,
      user_id: userId,
      published_by_user: valor
    })
  })
    .then(() => {
      cargarPost(); // 👉 pasa al siguiente automáticamente
    })
    .catch(() => {
      mensaje.textContent = "❌ Error enviando respuesta";
    });
}

/* =========================
   INICIO
========================= */
cargarPost();