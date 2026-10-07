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

      const getProfileData = () => {
        // Try fetching live Medium stories first
        fetch(liveMediumUrl)
          .then(result => {
            if (result.ok) {
              return result.json();
            }
            throw new Error(`Live Medium fetch failed with status: ${result.status}`);
          })
          .then(response => {
            if (response && response.status === "ok" && Array.isArray(response.items)) {
              setMediumBlogsFunction(response.items);
            } else {
              throw new Error("Invalid response structure from live Medium RSS feed");
            }
          })
          .catch(liveError => {
            console.warn(
              "Live Medium fetch failed, falling back to local blogs.json snapshot:",
              liveError
            );
            // Fallback to local snapshot
            fetch(`${process.env.PUBLIC_URL || ""}/blogs.json`)
              .then(result => {
                if (result.ok) {
                  return result.json();
                }
                throw result;
              })
              .then(response => {
                setMediumBlogsFunction(response.items || []);
              })
              .catch(fallbackError => {
                console.error(
                  `${fallbackError} (Blogs section reverted to hardcoded defaults)`
                );
                setMediumBlogsFunction("Error");
                blogSection.displayMediumBlogs = "false";
              });
          });
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
