import { useEffect } from 'react';

const SITE_NAME = 'GORKH';
const SITE_URL = 'https://gorkh.com';
const DEFAULT_IMAGE = `${SITE_URL}/images/logo.png`;

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  structuredData?: Record<string, unknown>;
};

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(url: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

function setStructuredData(data?: Record<string, unknown>) {
  document.head
    .querySelectorAll('script[data-gorkh-seo-json="true"]')
    .forEach((node) => node.remove());

  if (!data) return;

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.gorkhSeoJson = 'true';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function Seo({
  title,
  description,
  path = '/',
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  structuredData,
}: SeoProps) {
  useEffect(() => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${SITE_URL}${normalizedPath === '/' ? '' : normalizedPath}`;
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const robots = noindex ? 'noindex,nofollow' : 'index,follow';

    document.title = fullTitle;
    setCanonical(url);

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[name="robots"]', 'name', 'robots', robots);
    setMeta('meta[name="application-name"]', 'name', 'application-name', SITE_NAME);
    setMeta('meta[name="theme-color"]', 'name', 'theme-color', '#111010');

    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type);
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    setMeta('meta[property="og:image"]', 'property', 'og:image', image);
    setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', `${SITE_NAME} wordmark`);
    setMeta('meta[property="og:locale"]', 'property', 'og:locale', 'en_US');

    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    setMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', `${SITE_NAME} wordmark`);

    setStructuredData(structuredData);

    return () => setStructuredData();
  }, [description, image, noindex, path, structuredData, title, type]);

  return null;
}
