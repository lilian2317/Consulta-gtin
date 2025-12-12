export default async function handler(req, res) {
  try {
    const gtin = (req.query.gtin ?? "").toString().trim();
    if (!gtin) return res.status(400).json({ error: "GTIN vazio" });

    const notionToken = process.env.NOTION_TOKEN;
    const dbId = process.env.NOTION_DB_ID;

    const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: {
          property: "GTIN",
          rich_text: { equals: gtin },
        },
        page_size: 1,
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: "Erro Notion", details: data });

    const page = data.results?.[0];
    if (!page) return res.status(404).json({ found: false });

    const props = page.properties;

    const name =
      props["Nome dos Produtos"]?.title?.map(t => t.plain_text).join("") || "Sem nome";

    const preco =
      props["Domingas R$"]?.number ??
      props["Domingas R$"]?.rich_text?.map(t => t.plain_text).join("") ??
      null;

    const img =
      props["IMAGEM"]?.files?.[0]?.file?.url ??
      props["IMAGEM"]?.files?.[0]?.external?.url ??
      null;

    res.json({ found: true, gtin, name, preco, img });
  } catch (e) {
    res.status(500).json({ error: "Erro interno", details: String(e) });
  }
}