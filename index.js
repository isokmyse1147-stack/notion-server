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

    const cards = response.results.map((page) => {
      const props = page.properties;

      return {
        front: props["見出し語"]?.title?.[0]?.plain_text || "",
        meaning: props["意味"]?.rich_text?.[0]?.plain_text || "",
        related:
          props["関連語"]?.relation?.map((r) => r.id).join(",") || "",
      };
    });

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
    console.log("受信データ:", req.body);

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
        relatedRelation = [
          { id: searchRes.results[0].id },
        ];
      } else {
        console.log("関連語見つからない:", related);
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