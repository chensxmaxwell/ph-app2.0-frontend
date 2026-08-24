const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PH_AVATAR_PORT || 8099);
const engineDir = path.resolve(__dirname, "../assets/avatar-engine");

const FILES = {
  "/": ["viewer-page.html", "text/html; charset=utf-8"],
  "/viewer.html": ["viewer-page.html", "text/html; charset=utf-8"],
  "/ph-avatar/viewer.html": ["viewer-page.html", "text/html; charset=utf-8"],
  "/three.min.js": ["three.min.js", "application/javascript"],
  "/ph-avatar/three.min.js": ["three.min.js", "application/javascript"],
  "/GLTFLoader.js": ["GLTFLoader.js", "application/javascript"],
  "/ph-avatar/GLTFLoader.js": ["GLTFLoader.js", "application/javascript"],
  "/bozo-male.glb": ["bozo-male.glb", "model/gltf-binary"],
  "/ph-avatar/bozo-male.glb": ["bozo-male.glb", "model/gltf-binary"],
  "/parametric-base.glb": ["bozo-male.glb", "model/gltf-binary"],
  "/ph-avatar/parametric-base.glb": ["bozo-male.glb", "model/gltf-binary"],
};

function startAvatarStaticServer(port = PORT) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    const mapped = FILES[urlPath];
    if (!mapped) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const [fileName, contentType] = mapped;
    const filePath = path.join(engineDir, fileName);
    res.setHeader("Content-Type", contentType);
    fs.createReadStream(filePath)
      .on("error", () => {
        res.statusCode = 500;
        res.end("read error");
      })
      .pipe(res);
  });
  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      return;
    }
    console.warn("[avatar-static]", err);
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`[avatar-static] http://127.0.0.1:${port}/viewer.html`);
  });
  return server;
}

if (require.main === module) {
  startAvatarStaticServer();
}

module.exports = { startAvatarStaticServer, PORT };
