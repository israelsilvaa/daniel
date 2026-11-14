import { getStore } from "@netlify/blobs";

const MAX_REGISTROS = 2000;

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// dia, hora e minuto no horário de Belém (o servidor da Netlify roda em UTC)
function quando() {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t) => partes.find((p) => p.type === t).value;
  return { dia: `${g("day")}/${g("month")}/${g("year")}`, hora: `${g("hour")}:${g("minute")}` };
}

// mais acertos primeiro; empate: quem fez antes fica na frente
const ordenar = (lista) => lista.sort((a, b) => b.acertos - a.acertos || a.ts - b.ts);

export default async (req) => {
  const store = getStore("quiz-daniel");
  const lista = (await store.get("ranking", { type: "json" })) || [];

  if (req.method === "GET") {
    const total = parseInt(new URL(req.url).searchParams.get("total"), 10);
    const filtrada = Number.isInteger(total) ? lista.filter((r) => r.total === total) : lista;
    return json({ ranking: ordenar(filtrada).slice(0, 20) });
  }

  if (req.method === "POST") {
    let corpo;
    try { corpo = await req.json(); } catch { return json({ erro: "JSON inválido" }, 400); }

    const nome = String(corpo.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
    const { acertos, total } = corpo;
    const valido =
      nome && Number.isInteger(acertos) && Number.isInteger(total) &&
      total >= 1 && total <= 1000 && acertos >= 0 && acertos <= total;
    if (!valido) return json({ erro: "Dados inválidos" }, 400);

    const dicas = corpo.dicas === true;
    const entrada = { id: crypto.randomUUID(), nome, acertos, total, dicas, ...quando(), ts: Date.now() };
    lista.push(entrada);
    await store.setJSON("ranking", lista.slice(-MAX_REGISTROS));

    const daRodada = ordenar(lista.filter((r) => r.total === total));
    return json({
      entrada,
      posicao: daRodada.findIndex((r) => r.id === entrada.id) + 1,
      participantes: daRodada.length,
      ranking: daRodada.slice(0, 20),
    });
  }

  return json({ erro: "Método não permitido" }, 405);
};

export const config = { path: "/api/ranking" };
