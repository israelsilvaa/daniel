import { getStore, listStores } from "@netlify/blobs";

// Nome mais provável da store do ranking (tentado primeiro).
// Se não houver nada nela, o reset descobre e limpa as stores que existirem no site.
const STORE_NAME = "ranking";

async function limpar(nome) {
  const store = getStore(nome);
  const { blobs } = await store.list();
  for (const b of blobs) await store.delete(b.key);
  return blobs.length;
}

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });

export default async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, erro: "Método não permitido" }, 405, { allow: "POST" });
  }

  try {
    const detalhes = {};
    let apagados = await limpar(STORE_NAME);
    detalhes[STORE_NAME] = apagados;

    if (apagados === 0) {
      const { stores } = await listStores();
      for (const nome of stores) {
        if (nome === STORE_NAME) continue;
        const n = await limpar(nome);
        detalhes[nome] = n;
        apagados += n;
      }
      if (apagados === 0) {
        return json({ ok: false, erro: "Nenhum registro encontrado em nenhuma store.", stores, detalhes }, 404);
      }
    }

    return json({ ok: true, apagados, detalhes });
  } catch (e) {
    return json({ ok: false, erro: String(e?.message || e) }, 500);
  }
};

export const config = { path: "/api/rank-reset" };
