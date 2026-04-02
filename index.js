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
// GET（カード取得）
// =======================
app.get("/cards", async (req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
    });

    // ⭐ ① 全ページをID→タイトル辞書にする
    const pageMap = {};
    response.results.forEach((page) => {
      const title =
        page.properties["見出し語"]?.title?.[0]?.plain_text || "";

      pageMap[page.id] = title;
    });

    // ⭐ ② カード生成
    const cards = response.results.map((page) => {
      const props = page.properties;

      let relatedWords = [];

      if (props["関連語"]?.relation?.length > 0) {
        relatedWords = props["関連語"].relation.map((rel) => ({
          id: rel.id,
          title: pageMap[rel.id] || "???", // ←ここが安定化ポイント
        }));
      }

      return {
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
    });

    res.json(cards);
  } catch (err) {
    console.error("GETエラー:", err);
    res.status(500).send("GETエラー");
  }
});

// =======================
// POST（カード追加）
// =======================
app.post("/cards", async (req, res) => {
  try {
    console.log("受信データ:", req.body);

    const {
      front,
      meaning,
      note,
      type,
      related,
      genre,
      source,
      reading,
    } = req.body || {};

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
        relatedRelation = [
          {
            id: searchRes.results[0].id,
          },
        ];
      } else {
        console.log("関連語が見つからない:", related);
      }
    }

    await notion.pages.create({
      parent: {
        database_id: DATABASE_ID,
      },
      properties: {
        見出し語: {
          title: [{ text: { content: front || "" } }],
        },

        意味: {
          rich_text: [{ text: { content: meaning || "" } }],
        },

        備考: {
          rich_text: [{ text: { content: note || "" } }],
        },

        読みがな: {
          rich_text: [{ text: { content: reading || "" } }],
        },

        性質: {
          multi_select: (type || "")
            .split(",")
            .filter(Boolean)
            .map((v) => ({ name: v.trim() })),
        },

        ジャンル: {
          multi_select: (genre || "")
            .split(",")
            .filter(Boolean)
            .map((v) => ({ name: v.trim() })),
        },

        参考文献: {
          url: source && source.startsWith("http") ? source : null,
        },

        関連語: {
          relation: relatedRelation,
        },
      },
    });

    console.log("追加成功！");
    res.json({ message: "追加成功" });

  } catch (err) {
    console.error("POSTエラー:", err);
    res.status(500).send("追加失敗");
  }
});

app.listen(3000, () => console.log("server起動"));