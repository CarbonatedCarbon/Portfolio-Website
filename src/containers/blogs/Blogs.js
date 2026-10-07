import React, {useState, useEffect, useContext} from "react";
import "./Blog.scss";
import BlogCard from "../../components/blogCard/BlogCard";
import {blogSection} from "../../portfolio";
import {Fade} from "react-reveal";
import StyleContext from "../../contexts/StyleContext";
export default function Blogs() {
  const {isDark} = useContext(StyleContext);
  const [mediumBlogs, setMediumBlogs] = useState([]);
  function setMediumBlogsFunction(array) {
    setMediumBlogs(array);
  }
  //Medium API returns blogs' content in HTML format. Below function extracts blogs' text content within paragraph tags
  function extractTextContent(html) {
    return typeof html === "string"
      ? html
          .split("p>")
          .filter(el => !el.includes(">"))
          .map(el => el.replace("</", ".").replace("<", ""))
          .join(" ")
      : NaN;
  }
  useEffect(() => {
    if (blogSection.displayMediumBlogs === "true") {
      const mediumUsername = blogSection.mediumUsername || "gameplays322";
      const liveMediumUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@${mediumUsername}`;
      // blogs.json is regenerated hourly by GitHub Actions directly from Medium's RSS.
      // The timestamp query bypasses the browser/GitHub Pages cache so the newest snapshot is used.
      const snapshotUrl = `${process.env.PUBLIC_URL || ""}/blogs.json?v=${Date.now()}`;

      const loadFeed = url =>
        fetch(url)
          .then(result => {
            if (result.ok) {
              return result.json();
            }
            throw new Error(`Request to ${url} failed with status: ${result.status}`);
          })
          .then(response => {
            if (response && Array.isArray(response.items)) {
              return response.items;
            }
            throw new Error(`Invalid feed structure from ${url}`);
          })
          .catch(error => {
            console.warn(error);
            return null;
          });

      // Feed dates look like "YYYY-MM-DD HH:mm:ss" (UTC)
      const newestDate = items =>
        items.reduce((latest, item) => {
          const time = Date.parse(String(item.pubDate || "").replace(" ", "T") + "Z");
          return isNaN(time) ? latest : Math.max(latest, time);
        }, 0);

      const getProfileData = () => {
        // rss2json can serve a stale cached copy of the feed, so load both sources
        // and display whichever one contains the most recent article.
        Promise.all([loadFeed(liveMediumUrl), loadFeed(snapshotUrl)]).then(
          ([liveItems, snapshotItems]) => {
            const feeds = [liveItems, snapshotItems].filter(
              items => items && items.length > 0
            );
            if (feeds.length === 0) {
              console.error(
                "No Medium articles could be loaded (Blogs section reverted to hardcoded defaults)"
              );
              setMediumBlogsFunction("Error");
              blogSection.displayMediumBlogs = "false";
              return;
            }
            const freshest = feeds.reduce((best, items) =>
              newestDate(items) > newestDate(best) ? items : best
            );
            setMediumBlogsFunction(freshest);
          }
        );
      };
      getProfileData();
    }
  }, []);
  if (!blogSection.display) {
    return null;
  }
  return (
    <Fade bottom duration={1000} distance="20px">
      <div className="main" id="blogs">
        <div className="blog-header">
          <h1 className="blog-header-text">{blogSection.title}</h1>
          <p
            className={
              isDark ? "dark-mode blog-subtitle" : "subTitle blog-subtitle"
            }
          >
            {blogSection.subtitle}
          </p>
        </div>
        <div className="blog-main-div">
          <div className="blog-text-div">
            {blogSection.displayMediumBlogs !== "true" ||
            mediumBlogs === "Error"
              ? blogSection.blogs.map((blog, i) => {
                  return (
                    <BlogCard
                      key={i}
                      isDark={isDark}
                      blog={{
                        url: blog.url,
                        image: blog.image,
                        title: blog.title,
                        description: blog.description
                      }}
                    />
                  );
                })
              : mediumBlogs.map((blog, i) => {
                  return (
                    <BlogCard
                      key={i}
                      isDark={isDark}
                      blog={{
                        url: blog.link,
                        title: blog.title,
                        description: extractTextContent(blog.content)
                      }}
                    />
                  );
                })}
          </div>
        </div>
      </div>
    </Fade>
  );
}
