import { getStore } from "@netlify/blobs";

// O ranking guarda só os melhores. Para mudar o tamanho, troque este número.
const LIMITE = 10;
const SEM_TEMPO = Number.MAX_SAFE_INTEGER; // registros antigos, sem tempo, ficam atrás no desempate

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

// Cada resultado é guardado como foi na hora (acertos e total daquela rodada), sem depender
// do tamanho atual do banco de perguntas. A ordem usa a porcentagem de acertos (acertos/total),
// então rodadas de bancos diferentes continuam comparáveis.
// 1) maior % de acertos  2) menor tempo  3) quem fez primeiro
const ordenar = (lista) =>
  lista.sort(
    (a, b) =>
      b.acertos * a.total - a.acertos * b.total ||
      (a.tempo ?? SEM_TEMPO) - (b.tempo ?? SEM_TEMPO) ||
      a.ts - b.ts
  );

export default async (req) => {
  const store = getStore("quiz-daniel");
  const lista = (await store.get("ranking", { type: "json" })) || [];

  if (req.method === "GET") {
    return json({ ranking: ordenar(lista).slice(0, LIMITE) });
  }

  if (req.method === "POST") {
    let corpo;
    try { corpo = await req.json(); } catch { return json({ erro: "JSON inválido" }, 400); }

    const nome = String(corpo.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
    const { acertos, total, tempo } = corpo;
    const valido =
      nome &&
      Number.isInteger(acertos) && Number.isInteger(total) && Number.isInteger(tempo) &&
      total >= 1 && total <= 5000 && acertos >= 0 && acertos <= total &&
      tempo >= 0 && tempo <= 24 * 60 * 60 * 1000;
    if (!valido) return json({ erro: "Dados inválidos" }, 400);

    const entrada = {
      id: crypto.randomUUID(), nome, acertos, total, tempo,
      dicas: corpo.dicas === true, ...quando(), ts: Date.now(),
    };
    lista.push(entrada);

    // fica só o top: se entrou o 11º, sai o pior
    const top = ordenar(lista).slice(0, LIMITE);
    await store.setJSON("ranking", top);

    const posicao = top.findIndex((r) => r.id === entrada.id) + 1; // 0 = não entrou
    return json({ entrou: posicao > 0, posicao: posicao || null, entrada, ranking: top });
  }

  return json({ erro: "Método não permitido" }, 405);
};

export const config = { path: "/api/ranking" };
