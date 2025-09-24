// netlify/functions/tmdb.js
const fetch = require("node-fetch");

exports.handler = async function (event) {
  try {
    const { path } = event.queryStringParameters;
    if (!path) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing TMDB path" }),
      };
    }

    const apiKey = process.env.TMDB_KEY; // 🔑 Hidden in Netlify
    const url = `https://api.themoviedb.org/3/${path}?api_key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
