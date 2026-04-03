const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const app = express();

app.use(cors());
app.use(express.json());

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// =======================
// GET
// =======================
app.get("/cards", async (req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
    });

    const cards = await Promise.all(
      response.results.map(async (page) => {
        const props = page.properties;

        let relatedWords = [];

        if (props["関連語"]?.relation?.length > 0) {
          for (const rel of props["関連語"].relation) {
            const relPage = await notion.pages.retrieve({
              page_id: rel.id,
            });

            const title =
              relPage.properties["見出し語"]?.title?.[0]?.plain_text || "";

            relatedWords.push({
              id: rel.id,
              title,
            });
          }
        }

        return {
  id: page.id,
  notionUrl: page.url,

  front: props["見出し語"]?.title?.[0]?.plain_text || "",
  meaning: props["意味"]?.rich_text?.[0]?.plain_text || "",
  note: props["備考"]?.rich_text?.[0]?.plain_text || "",
  reading: props["読みがな"]?.rich_text?.[0]?.plain_text || "",

  type:
    props["性質"]?.multi_select?.map((v) => v.name).join(",") || "",
  genre:
    props["ジャンル"]?.multi_select?.map((v) => v.name).join(",") || "",

  related: relatedWords,
  source: props["参考文献"]?.url || "",
};
      })
    );

    res.json(cards);
  } catch (err) {
    console.error("GETエラー:", err);
    res.status(500).send("GETエラー");
  }
});

// =======================
// POST
// =======================
app.post("/cards", async (req, res) => {
  try {
    const { front, meaning, related } = req.body;

    let relatedRelation = [];

    if (related && related.trim() !== "") {
      const searchRes = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: {
          property: "見出し語",
          title: {
            equals: related.trim(),
          },
        },
      });

      if (searchRes.results.length > 0) {
        relatedRelation = [{ id: searchRes.results[0].id }];
      }
    }

    await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        見出し語: {
          title: [{ text: { content: front || "" } }],
        },
        意味: {
          rich_text: [{ text: { content: meaning || "" } }],
        },
        関連語: {
          relation: relatedRelation,
        },
      },
    });

    res.json({ message: "追加成功" });
  } catch (err) {
    console.error("POSTエラー:", err);
    res.status(500).send("追加失敗");
  }
});

app.listen(3000, () => console.log("server起動"));