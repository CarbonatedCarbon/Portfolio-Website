fs = require("fs");
const https = require("https");
process = require("process");
require("dotenv").config();

const GITHUB_TOKEN = process.env.REACT_APP_GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const USE_GITHUB_DATA = process.env.USE_GITHUB_DATA;
const MEDIUM_USERNAME = process.env.MEDIUM_USERNAME;

const ERR = {
  noUserName:
    "Github Username was found to be undefined. Please set all relevant environment variables.",
  requestFailed:
    "The request to GitHub didn't succeed. Check if GitHub token in your .env file is correct.",
  requestFailedMedium:
    "The request to Medium didn't succeed. Check if Medium username in your .env file is correct."
};
if (USE_GITHUB_DATA === "true") {
  if (GITHUB_USERNAME === undefined) {
    throw new Error(ERR.noUserName);
  }

  console.log(`Fetching profile data for ${GITHUB_USERNAME}`);
  var data = JSON.stringify({
    query: `
{
  user(login:"${GITHUB_USERNAME}") { 
    name
    bio
    avatarUrl
    location
    pinnedItems(first: 6, types: [REPOSITORY]) {
      totalCount
      edges {
          node {
            ... on Repository {
              name
              description
              forkCount
              stargazers {
                totalCount
              }
              url
              id
              diskUsage
              primaryLanguage {
                name
                color
              }
              repositoryTopics(first: 10) {
                nodes {
                  topic {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
}
`
  });
  const default_options = {
    hostname: "api.github.com",
    path: "/graphql",
    port: 443,
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "Node"
    }
  };

  const req = https.request(default_options, res => {
    let data = "";

    console.log(`statusCode: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      throw new Error(ERR.requestFailed);
    }

    res.on("data", d => {
      data += d;
    });
    res.on("end", () => {
      // GitHub returns HTTP 200 even when a GraphQL query fails, so check the body.
      // Never save an error response as profile.json: stop the build instead, so a
      // broken Projects section is never deployed.
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        console.error("GitHub GraphQL returned invalid JSON. " + ERR.requestFailed);
        process.exit(1);
      }
      if (
        parsed.errors ||
        !parsed.data ||
        !parsed.data.user ||
        !parsed.data.user.pinnedItems
      ) {
        console.error(
          "GitHub GraphQL returned errors - profile.json was NOT updated. " +
            "If this is running in GitHub Actions, make sure the GH_PAT repository secret is set.\n" +
            JSON.stringify(parsed.errors || parsed, null, 2)
        );
        process.exit(1);
      }
      fs.writeFile("./public/profile.json", data, function (err) {
        if (err) return console.log(err);
        console.log("saved file to public/profile.json");
      });
    });
  });

  req.on("error", error => {
    throw error;
  });

  req.write(data);
  req.end();
}

// Medium blogs are read directly from Medium's RSS feed. Third-party converters
// such as rss2json cache feeds and can serve stale articles, so rss2json is only
// used as a fallback if Medium itself cannot be reached.
function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

// Formats a date as "YYYY-MM-DD HH:mm:ss" (UTC), matching the rss2json format
function toFeedDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toISOString().replace("T", " ").substring(0, 19);
}

function parseMediumRss(xml) {
  const items = (xml.match(/<item>[\s\S]*?<\/item>/g) || []).map(item => {
    const content = getTag(item, "content:encoded");
    return {
      title: getTag(item, "title"),
      pubDate: toFeedDate(getTag(item, "pubDate")),
      link: getTag(item, "link"),
      guid: getTag(item, "guid"),
      author: getTag(item, "dc:creator"),
      thumbnail: "",
      description: content,
      content: content,
      categories: (item.match(/<category>[\s\S]*?<\/category>/g) || []).map(
        c => getTag(c, "category")
      )
    };
  });
  return {
    status: "ok",
    feed: {url: `https://medium.com/feed/@${MEDIUM_USERNAME}`},
    items: items
  };
}

function saveBlogs(blogData, source) {
  fs.writeFile("./public/blogs.json", blogData, function (err) {
    if (err) return console.log(err);
    console.log(`saved file to public/blogs.json (source: ${source})`);
  });
}

function fetchMediumViaRss2Json() {
  const options = {
    hostname: "api.rss2json.com",
    path: `/v1/api.json?rss_url=https://medium.com/feed/@${MEDIUM_USERNAME}`,
    port: 443,
    method: "GET"
  };

  const req = https.request(options, res => {
    let mediumData = "";

    console.log(`rss2json statusCode: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      console.log(ERR.requestFailedMedium + " Keeping existing blogs.json.");
      res.resume();
      return;
    }

    res.on("data", d => {
      mediumData += d;
    });
    res.on("end", () => saveBlogs(mediumData, "rss2json fallback"));
  });

  req.on("error", error => {
    console.log(`${error} - keeping existing blogs.json.`);
  });

  req.end();
}

if (MEDIUM_USERNAME !== undefined) {
  console.log(`Fetching Medium blogs data for ${MEDIUM_USERNAME}`);
  const options = {
    hostname: "medium.com",
    path: `/feed/@${MEDIUM_USERNAME}`,
    port: 443,
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (portfolio build script)",
      Accept: "application/rss+xml, application/xml, text/xml"
    }
  };

  const req = https.request(options, res => {
    let rssData = "";

    console.log(`Medium RSS statusCode: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      res.resume();
      console.log("Medium RSS unavailable, falling back to rss2json.");
      fetchMediumViaRss2Json();
      return;
    }

    res.on("data", d => {
      rssData += d;
    });
    res.on("end", () => {
      const parsed = parseMediumRss(rssData);
      if (parsed.items.length === 0) {
        console.log("Medium RSS contained no articles, falling back to rss2json.");
        fetchMediumViaRss2Json();
        return;
      }
      saveBlogs(JSON.stringify(parsed), "Medium RSS");
    });
  });

  req.on("error", error => {
    console.log(`${error} - falling back to rss2json.`);
    fetchMediumViaRss2Json();
  });

  req.end();
}
