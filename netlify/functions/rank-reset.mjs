import { getStore } from "@netlify/blobs";

// ⚠️ Use o MESMO nome de store que a função /api/ranking usa no getStore(...)
const STORE_NAME = "ranking";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ erro: "Método não permitido" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST" },
    });
  }

  try {
    const store = getStore(STORE_NAME);
    let apagados = 0;

    // apaga tudo que existe na store (com paginação)
    const { blobs } = await store.list();
    for (const b of blobs) {
      await store.delete(b.key);
      apagados++;
    }

    return new Response(JSON.stringify({ ok: true, apagados }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, erro: String(e?.message || e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config = { path: "/api/rank-reset" };
