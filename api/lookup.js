export default async function handler(req, res) {
  try {
    const q = (req.query.q ?? "").toString().trim();      // busca geral
    const gtin = (req.query.gtin ?? "").toString().trim(); // opcional
    const name = (req.query.name ?? "").toString().trim(); // opcional

    const notionToken = process.env.NOTION_TOKEN;
    const dbId = process.env.NOTION_DB_ID;

    // Se mandarem gtin/name explicitamente, usa eles.
    // Se mandarem só q, decide: se for só números -> GTIN; senão -> Nome.
    let gtinQuery = gtin;
    let nameQuery = name;

    if (!gtinQuery && !nameQuery && q) {
      if (/^\d+$/.test(q)) gtinQuery = q;  // só dígitos = GTIN
      else nameQuery = q;                  // texto = Nome
    }

    if (!gtinQuery && !nameQuery) {
      return res.status(400).json({ error: "Informe GTIN ou Nome" });
    }

    // filtro OR: GTIN == ...  OU  Nome contém ...
    const orFilters = [];
    if (gtinQuery) {
      orFilters.push({
        property: "GTIN",
        rich_text: { equals: gtinQuery },
      });
    }
    if (nameQuery) {
      orFilters.push({
        property: "Nome dos Produtos",
        title: { contains: nameQuery },
      });
    }

    const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: orFilters.length === 1 ? orFilters[0] : { or: orFilters },
        page_size: 10, // se buscar por nome pode vir mais de 1
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: "Erro Notion", details: data });

    const results = data.results ?? [];
    if (!results.length) return res.status(404).json({ found: false, items: [] });

    const items = results.map((page) => {
      const props = page.properties;

      const nameOut =
        props["Nome dos Produtos"]?.title?.map(t => t.plain_text).join("") || "Sem nome";

      const preco =
        props["Domingas R$"]?.number ??
        props["Domingas R$"]?.rich_text?.map(t => t.plain_text).join("") ??
        null;

      const img =
        props["IMAGEM"]?.files?.[0]?.file?.url ??
        props["IMAGEM"]?.files?.[0]?.external?.url ??
        null;

      const gtinOut =
        props["GTIN"]?.rich_text?.map(t => t.plain_text).join("") || null;

      return { name: nameOut, preco, img, gtin: gtinOut };
    });

    res.json({ found: true, items });
  } catch (e) {
    res.status(500).json({ error: "Erro interno", details: String(e) });
  }
}