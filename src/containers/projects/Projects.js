import React, {useState, useEffect, useContext, Suspense, lazy} from "react";
import "./Project.scss";
import Button from "../../components/button/Button";
import {openSource, socialMediaLinks} from "../../portfolio";
import StyleContext from "../../contexts/StyleContext";
import Loading from "../../containers/loading/Loading";
const PINNED_CACHE_KEY = "portfolio_pinned_repos_cache_v1";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export default function Projects() {
  const GithubRepoCard = lazy(() =>
    import("../../components/githubRepoCard/GithubRepoCard")
  );
  const FailedLoading = () => null;
  const renderLoader = () => <Loading />;
  const [repo, setrepo] = useState([]);
  const {isDark} = useContext(StyleContext);

  useEffect(() => {
    let isMounted = true;
    const username = openSource.githubUserName || "CarbonatedCarbon";

    // 1. Check local storage cache for instant render
    let hasValidCache = false;
    try {
      const cached = localStorage.getItem(PINNED_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          Array.isArray(parsed.data) &&
          parsed.timestamp &&
          Date.now() - parsed.timestamp < CACHE_TTL_MS
        ) {
          setrepo(parsed.data);
          hasValidCache = true;
        }
      }
    } catch (e) {
      console.warn("Could not read pinned repos cache from localStorage:", e);
    }

    // Helper: fallback to local public/profile.json
    const fallbackToProfileJson = () => {
      fetch(`${process.env.PUBLIC_URL || ""}/profile.json`)
        .then(result => {
          if (result.ok) {
            return result.json();
          }
          throw result;
        })
        .then(response => {
          if (isMounted) {
            const edges = response?.data?.user?.pinnedItems?.edges || [];
            setrepo(edges);
          }
        })
        .catch(error => {
          console.error(
            `${error} (because of this error, nothing is shown in place of Projects section)`
          );
          if (isMounted && !hasValidCache) {
            setrepo("Error");
          }
        });
    };

    // 2. Fetch live pinned repositories
    const fetchLivePinnedRepos = async () => {
      try {
        const liveRes = await fetch(
          `https://pinned.berrysauce.dev/get/${username}`
        );
        if (!liveRes.ok) {
          throw new Error(`Live pinned API returned status: ${liveRes.status}`);
        }
        const pinnedList = await liveRes.json();
        if (!Array.isArray(pinnedList) || pinnedList.length === 0) {
          throw new Error("No pinned repositories returned");
        }

        // Fetch topics and details in parallel for each repo
        const enrichedEdges = await Promise.all(
          pinnedList.map(async (item, idx) => {
            let topics = [];
            let extraDescription = item.description;
            let extraStars = item.stars || 0;
            let extraForks = item.forks || 0;
            let extraSize = 0;
            let repoUrl = `https://github.com/${item.author}/${item.name}`;

            try {
              const ghRes = await fetch(
                `https://api.github.com/repos/${item.author}/${item.name}`
              );
              if (ghRes.ok) {
                const ghData = await ghRes.json();
                if (Array.isArray(ghData.topics)) {
                  topics = ghData.topics;
                }
                if (ghData.description) {
                  extraDescription = ghData.description;
                }
                if (typeof ghData.stargazers_count === "number") {
                  extraStars = ghData.stargazers_count;
                }
                if (typeof ghData.forks_count === "number") {
                  extraForks = ghData.forks_count;
                }
                if (typeof ghData.size === "number") {
                  extraSize = ghData.size;
                }
                if (ghData.html_url) {
                  repoUrl = ghData.html_url;
                }
              }
            } catch (err) {
              console.warn(
                `Could not fetch extra metadata for ${item.name}:`,
                err
              );
            }

            return {
              node: {
                id: `live_${item.author}_${item.name}_${idx}`,
                name: item.name,
                description: extraDescription,
                url: repoUrl,
                forkCount: extraForks,
                stargazers: {
                  totalCount: extraStars
                },
                diskUsage: extraSize,
                primaryLanguage: item.language
                  ? {
                      name: item.language,
                      color: item.languageColor || "#888888"
                    }
                  : null,
                repositoryTopics: topics
              }
            };
          })
        );

        if (isMounted) {
          setrepo(enrichedEdges);
          try {
            localStorage.setItem(
              PINNED_CACHE_KEY,
              JSON.stringify({timestamp: Date.now(), data: enrichedEdges})
            );
          } catch (e) {
            console.warn("Could not save to localStorage:", e);
          }
        }
      } catch (liveError) {
        console.warn("Live pinned fetch failed, using fallback:", liveError);
        if (!hasValidCache) {
          fallbackToProfileJson();
        }
      }
    };

    fetchLivePinnedRepos();

    return () => {
      isMounted = false;
    };
  }, []);
  if (
    !(typeof repo === "string" || repo instanceof String) &&
    openSource.display
  ) {
    return (
      <Suspense fallback={renderLoader()}>
        <div className="main" id="opensource">
          <h1 className="project-title">Open Source Projects</h1>
          <div className="repo-cards-div-main">
            {repo.map((v, i) => {
              if (!v) {
                console.error(
                  `Github Object for repository number : ${i} is undefined`
                );
              }
              return (
                <GithubRepoCard repo={v} key={v.node.id} isDark={isDark} />
              );
            })}
          </div>
          <Button
            text={"More Projects"}
            className="project-button"
            href={socialMediaLinks.github}
            newTab={true}
          />
        </div>
      </Suspense>
    );
  } else {
    return <FailedLoading />;
  }
}
