import React, {useState, useEffect, lazy, Suspense} from "react";
import {openSource} from "../../portfolio";
import Contact from "../contact/Contact";
import Loading from "../loading/Loading";

const renderLoader = () => <Loading />;
const GithubProfileCard = lazy(() =>
  import("../../components/githubProfileCard/GithubProfileCard")
);
export default function Profile() {
  const [prof, setrepo] = useState([]);
  function setProfileFunction(array) {
    setrepo(array);
  }

  useEffect(() => {
    if (openSource.showGithubProfile === "true") {
      const username = openSource.githubUserName || "CarbonatedCarbon";
      const getProfileData = () => {
        fetch(`https://api.github.com/users/${username}`)
          .then(result => {
            if (result.ok) {
              return result.json();
            }
            throw new Error("Live GitHub profile fetch failed");
          })
          .then(userData => {
            setProfileFunction({
              name: userData.name || username,
              bio: userData.bio || "",
              avatarUrl: userData.avatar_url,
              location: userData.location,
              id: userData.node_id || userData.id
            });
          })
          .catch(() => {
            fetch(`${process.env.PUBLIC_URL || ""}/profile.json`)
              .then(result => {
                if (result.ok) {
                  return result.json();
                }
              })
              .then(response => {
                if (response && response.data && response.data.user) {
                  setProfileFunction(response.data.user);
                }
              })
              .catch(function (error) {
                console.error(
                  `${error} (Contact section has reverted to default)`
                );
                setProfileFunction("Error");
                openSource.showGithubProfile = "false";
              });
          });
      };
      getProfileData();
    }
  }, []);
  if (
    openSource.display &&
    openSource.showGithubProfile === "true" &&
    !(typeof prof === "string" || prof instanceof String)
  ) {
    return (
      <Suspense fallback={renderLoader()}>
        <GithubProfileCard prof={prof} key={prof.id} />
      </Suspense>
    );
  } else {
    return <Contact />;
  }
}
