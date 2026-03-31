const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const app = express();
app.use(cors());

const notion = new Client({
  auth: "ntn_h6352128105pElkNRlD9TmZUHhsyZRjld3IPozAxj879CT"
});

const DATABASE_ID = "44b17a9dc869834397f4817b7190d4f4";

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

      const front = props["見出し語"]?.title?.[0]?.plain_text 
           || props["Name"]?.title?.[0]?.plain_text 
           || "";

      let back = "";

      for (let key in props) {
        if (key === "見出し語") continue;

        const p = props[key];

        if (p?.rich_text?.length) {
          back += `${key}: ${p.rich_text[0].plain_text}\n`;
        }
      }

      return { front, back };
    });

    res.json(cards);

  } catch (err) {
    console.error(err);
    res.status(500).send("エラー");
  }
});

app.listen(3000, () => console.log("server起動"));