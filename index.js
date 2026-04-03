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
// GET /cards（そのままOK）
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
    res.status(500).json({ error: "GETエラー" });
  }
});

// =======================
// POST /add（完全修正版）
// =======================
app.post("/add", async (req, res) => {
  try {
    const body = req.body;

    console.log("受信データ:", body);

    // ===== 関連語（relation変換）=====
    let relatedRelation = [];

    if (body.related && body.related.trim() !== "") {
      const searchRes = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: {
          property: "見出し語",
          title: {
            equals: body.related.trim(),
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
        // ===== 必須 =====
        見出し語: {
          title: [{ text: { content: body.front || "" } }],
        },

        意味: {
          rich_text: [{ text: { content: body.meaning || "" } }],
        },

        参考文献: {
          url: body.source || null,
        },

        ジャンル: {
          multi_select: (body.genre || "")
            .split(",")
            .filter(Boolean)
            .map((v) => ({ name: v.trim() })),
        },

        // ===== 追加修正 =====
        備考: {
          rich_text: [{ text: { content: body.note || "" } }],
        },

        性質: {
          multi_select: (body.nature || "")
            .split(",")
            .filter(Boolean)
            .map((v) => ({ name: v.trim() })),
        },

        読みがな: {
          rich_text: [{ text: { content: body.yomigana || "" } }],
        },

        // ⭐ここが修正ポイント（relation）
        関連語: {
          relation: relatedRelation,
        },
      },
    });

    res.json({ message: "追加成功" });

  } catch (err) {
    console.error("POSTエラー:", err);
    res.status(500).json({ error: "追加失敗" });
  }
});

app.listen(3000, () => console.log("server起動"));