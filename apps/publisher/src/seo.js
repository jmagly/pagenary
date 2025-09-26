const DEFAULT_TITLE = 'Docs Toolkit';
const DESCRIPTION_TAG = 'meta[name="description"]';

export function updateMetaTags({ title, description }) {
  const pageTitle = title ? `${title} · ${DEFAULT_TITLE}` : DEFAULT_TITLE;
  document.title = pageTitle;

  let descriptionTag = document.querySelector(DESCRIPTION_TAG);
  if (!descriptionTag) {
    descriptionTag = document.createElement('meta');
    descriptionTag.setAttribute('name', 'description');
    document.head.appendChild(descriptionTag);
  }
  if (description) {
    descriptionTag.setAttribute('content', description);
  }
}
