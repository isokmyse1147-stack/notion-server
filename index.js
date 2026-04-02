const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const app = express();
app.use(cors());
app.use(express.json());

// Notion
const notion = new Client({
  auth: "YOUR_NOTION_SECRET" // ←本番は.envにするの推奨
});

const DATABASE_ID = "44b17a9dc869834397f4817b7190d4f4";


// =======================
// GET（カード取得）
// =======================
app.get("/cards", async (req, res) => {
  try {
    const response = await notion.search({
      filter: {
        property: "object",
        value: "page"
      }
    });

    const cards = response.results.map(page => {
      const props = page.properties || {};

      return {
        front: props["見出し語"]?.title?.[0]?.plain_text || "",
        meaning: props["意味"]?.rich_text?.[0]?.plain_text || "",
        note: props["備考"]?.rich_text?.[0]?.plain_text || "",
        reading: props["読みがな"]?.rich_text?.[0]?.plain_text || "",

        type: props["性質"]?.multi_select?.map(v => v.name).join(",") || "",
        genre: props["ジャンル"]?.multi_select?.map(v => v.name).join(",") || "",

        related: props["関連語"]?.rich_text?.[0]?.plain_text || "",
        source: props["参考文献"]?.url || ""
      };
    });

    res.json(cards);
  } catch (err) {
    console.error(err);
    res.status(500).send("取得エラー");
  }
});


// =======================
// POST（カード追加）
// =======================
app.post("/cards", async (req, res) => {
  try {
    console.log(req.body); // デバッグ用

    const {
      front,
      meaning,
      note,
      type,
      related,
      genre,
      source,
      reading
    } = req.body;

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
            .map(v => ({ name: v.trim() })),
        },

        ジャンル: {
          multi_select: (genre || "")
            .split(",")
            .filter(Boolean)
            .map(v => ({ name: v.trim() })),
        },

        関連語: {
          rich_text: [
            { text: { content: related || "" } }
          ],
        },

        参考文献: {
          url: source || ""
        }
      },
    });

    res.json({ message: "追加成功" });

  } catch (err) {
    console.error(err);
    res.status(500).send("追加失敗");
  }
});


// =======================
// 起動
// =======================
app.listen(3000, () => console.log("server起動"));