const postsContainer = document.getElementById("postsContainer");

/* =========================
   CREAR POST
========================= */
async function createPost() {
  const message = document.getElementById("messageInput").value.trim();
  const imageInput = document.getElementById("imageInput");
  const file = imageInput.files[0];

  if (!message && !file) {
    alert("Escribe algo o sube una imagen.");
    return;
  }

  try {
    // 1️⃣ Crear post
    const response = await fetch("/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message || " " })
    });

    const newPost = await response.json();

    // 2️⃣ Subir imagen si existe
    if (file) {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("post_id", newPost.id);

      await fetch("/upload-image", {
        method: "POST",
        body: formData
      });
    }

    document.getElementById("messageInput").value = "";
    imageInput.value = "";

    loadPosts();

  } catch (error) {
    console.error("Error creando post:", error);
  }
}

/* =========================
   CARGAR POSTS
========================= */
async function loadPosts() {
  const response = await fetch("/posts");
  const posts = await response.json();

  postsContainer.innerHTML = "";

  for (let post of posts) {
    renderPost(post);
  }
}

/* =========================
   RENDER POST
========================= */
async function renderPost(post) {
  const postDiv = document.createElement("div");
  postDiv.className = "post";

  if (post.content) {
    const content = document.createElement("p");
    content.innerText = post.content;
    postDiv.appendChild(content);
  }

  // Cargar imagen desde backend
  const imgRes = await fetch(`/images/${post.id}`);
  const images = await imgRes.json();

  images.forEach(imgData => {
    const img = document.createElement("img");
    img.src = imgData.image_url;
    postDiv.appendChild(img);
  });

  const time = document.createElement("div");
  time.className = "time";
  time.innerText = "🕒 " + new Date(post.created_at).toLocaleString();
  postDiv.appendChild(time);

  // REACCIONES
  const reactionsDiv = document.createElement("div");
  reactionsDiv.className = "reactions";

  const reactionRes = await fetch(`/reactions/${post.id}`);
  const reactions = await reactionRes.json();

  const emojis = ["❤️", "😂", "😮", "🔥"];

  emojis.forEach(emoji => {
    const found = reactions.find(r => r.emoji === emoji);
    const count = found ? found.count : 0;

    const span = document.createElement("span");
    span.innerText = `${emoji} ${count}`;
    span.onclick = async () => {
      await fetch("/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id, emoji })
      });
      loadPosts();
    };

    reactionsDiv.appendChild(span);
  });

  postDiv.appendChild(reactionsDiv);

  // COMENTARIOS
  const commentsRes = await fetch(`/comments/${post.id}`);
  const comments = await commentsRes.json();

  const repliesContainer = document.createElement("div");
  repliesContainer.className = "replies";

  comments.forEach(comment => {
    const reply = document.createElement("div");
    reply.className = "reply";
    reply.innerText = comment.content;
    repliesContainer.appendChild(reply);
  });

  postDiv.appendChild(repliesContainer);

  // INPUT COMENTARIO
  const replyBox = document.createElement("div");
  replyBox.className = "reply-input-group";
  replyBox.innerHTML = `
    <input type="text" placeholder="Escribe un comentario...">
    <button>Publicar</button>
  `;

  replyBox.querySelector("button").onclick = async () => {
    const input = replyBox.querySelector("input");
    const text = input.value.trim();
    if (!text) return;

    await fetch("/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id, content: text })
    });

    loadPosts();
  };

  postDiv.appendChild(replyBox);

  postsContainer.appendChild(postDiv);
}

/* =========================
   MODAL
========================= */
function acceptRules() {
  const modal = document.getElementById("rulesModal");
  modal.style.display = "none";
}

window.onload = loadPosts;