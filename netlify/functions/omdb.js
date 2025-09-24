// netlify/functions/omdb.js
const fetch = require("node-fetch");

exports.handler = async function (event) {
  try {
    const { s, i, plot, type } = event.queryStringParameters;

    const apiKey = process.env.OMDB_KEY; // 🔑 Hidden in Netlify

    let url = `https://www.omdbapi.com/?apikey=${apiKey}`;
    if (s) url += `&s=${encodeURIComponent(s)}`;
    if (i) url += `&i=${encodeURIComponent(i)}`;
    if (plot) url += `&plot=${encodeURIComponent(plot)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;

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
