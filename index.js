const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const app = express();
app.use(cors());
app.use(express.json()); // ←1回だけでOK

const notion = new Client({
  auth: "ntn_h6352128105pElkNRlD9TmZUHhsyZRjld3IPozAxj879CT"
});

const DATABASE_ID = "44b17a9dc869834397f4817b7190d4f4";

// ===== 取得（GET）=====
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
    type: props["性質"]?.rich_text?.[0]?.plain_text || "",
    related: props["関連語"]?.rich_text?.[0]?.plain_text || "",
    genre: props["ジャンル"]?.rich_text?.[0]?.plain_text || "",
    source: props["参考文系"]?.rich_text?.[0]?.plain_text || "",
    reading: props["読みがな"]?.rich_text?.[0]?.plain_text || "",
  };
});
    res.json(cards);
  } catch (err) {
    console.error(err);
    res.status(500).send("エラー");
  }
});
console.log(req.body);
// ===== 追加（POST）=====
app.post("/cards", async (req, res) => {
  try {
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
        .map((v) => ({ name: v.trim() })),
    },

    ジャンル: {
      multi_select: (genre || "")
        .split(",")
        .filter(Boolean)
        .map((v) => ({ name: v.trim() })),
    },

    関連語: {
      rich_text: [
        { text: { content: related || "" } }
      ],
    },

    参考文献: {
      url: source || "",
    },
  },
});

    res.json({ message: "追加成功" });
  } catch (err) {
    console.error(err);
    res.status(500).send("追加失敗");
  }
});

app.listen(3000, () => console.log("server起動"));