import fetch from 'node-fetch';
import { Repo } from '../types';
import { getExampleList } from './example-list';

/**
 * Fetch the meta info of a public github repo
 * @param {object} repo parsed by the `parse-github-url` package
 */
export async function getGitHubRepoInfo(repo: Repo) {
  const response = await fetch(`https://api.github.com/repos/${repo.repo}`, {
    headers: {
      Accept: 'application/vnd.github.machine-man-preview+json',
    },
  });

  if (response.status !== 200) {
    console.log(`Non-200 response code from GitHub: ${response.status}`);
    console.log(await response.text());
    return null;
  }

  const parsed = await response.json();

  if (parsed.full_name !== repo.repo) {
    console.log(`Invalid response from GitHub`);
    console.log(`Received:`, parsed);
    return null;
  }

  const data: { [key: string]: any } = {
    id: parsed.full_name,
    name: parsed.name,
    url: parsed.html_url,
    owner: parsed.owner.login,
    description: parsed.description,
    homepage: parsed.homepage,
    size: parsed.size,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    stars: parsed.stargazers_count,
    branch: repo.branch,
  };

  const subdirPath = repo.repo + '/tree/' + repo.branch + '/';

  if (repo.path.startsWith(subdirPath)) {
    // subdir
    data.subdir = repo.path.slice(subdirPath.length).split('/');
  }

  if (data.id === 'zeit/now-examples' && data.subdir) {
    // from our examples, add `homepage` and `description` fields
    const example = data.subdir[0];
    const exampleList = await getExampleList();

    for (const t in exampleList) {
      if (exampleList[t].path === `/${example}`) {
        data.homepage = exampleList[t].demo;
        data.description = exampleList[t].description;
        data.exampleName = exampleList[t].example;
        data.icon = exampleList[t].icon;
        data.tagline = exampleList[t].tagline;
        data.framework = exampleList[t].framework;
        return data;
      }
    }
  }

  return data;
}
