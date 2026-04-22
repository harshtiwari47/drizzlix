import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeoForPath, seoGlobals, organizationSchema, websiteSchema } from '../services/seoConfig';

const toAbsoluteUrl = (value) => {
  if (!value) return seoGlobals.siteUrl;
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedPath = String(value).startsWith('/')
    ? String(value)
    : `/${String(value)}`;

  return `${seoGlobals.siteUrl}${normalizedPath}`;
};

const normalizeCanonicalPath = (value) => {
  const raw = String(value || '/').trim();
  const pathOnly = raw.split(/[?#]/)[0] || '/';
  if (pathOnly === '/') return '/';
  return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
};

const ensureMetaByName = (name) => {
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  return element;
};

const ensureMetaByProperty = (property) => {
  let element = document.head.querySelector(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  return element;
};

const ensureCanonical = () => {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  return canonical;
};

const upsertJsonLd = (schema) => {
  let script = document.head.querySelector('script[data-seo-json-ld="true"]');

  const normalizeSchemaList = () => {
    const schemas = [];
    if (schema) {
      if (Array.isArray(schema)) {
        schemas.push(...schema.filter((entry) => entry && typeof entry === 'object'));
      } else if (typeof schema === 'object') {
        schemas.push(schema);
      }
    }
    return schemas;
  };

  const schemaList = normalizeSchemaList();

  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-json-ld', 'true');
    document.head.appendChild(script);
  }

  // Deduplicate schemas dynamically just in case they were passed explicitly
  const uniqueSchemas = {};
  schemaList.forEach(s => {
    if (s && s['@type']) {
      // Prioritize FAQPage explicitly if encountered
      uniqueSchemas[s['@type']] = s;
    }
  });

  const graphEntries = Object.values(uniqueSchemas).map((entry) => {
    const nextEntry = { ...entry };
    delete nextEntry['@context'];
    return nextEntry;
  });

  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graphEntries,
  });
};

const SEOMeta = React.memo(function SEOMeta({ isAuthenticated = false }) {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const seo = getSeoForPath(location.pathname, isAuthenticated);
    
    const title = seo.title;
    const description = seo.description;
    const image = toAbsoluteUrl(seo.image || seoGlobals.defaultImage);
    const robots = seo.robots || 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
    const keywords = seo.keywords?.length ? seo.keywords.join(', ') : '';

    // ---------------------------------------------------------
    // DYNAMIC CANONICAL NORMALIZATION
    // ---------------------------------------------------------
    const normalizedPath =
      location.pathname !== '/' && location.pathname.endsWith('/')
        ? location.pathname.slice(0, -1)
        : location.pathname;

    const canonicalUrl = `https://drizzlix.vercel.app${normalizedPath}`;
    ensureCanonical().setAttribute('href', canonicalUrl);
    
    document.title = title;
    ensureMetaByName('description').setAttribute('content', description);

    // CRITICAL: Block indexing of protected app paths explicitly
    const noIndexPaths = ['/pomodoro', '/notes', '/tasks'];
    if (noIndexPaths.includes(normalizedPath)) {
      ensureMetaByName('robots').setAttribute('content', 'noindex, nofollow');
      ensureMetaByName('googlebot').setAttribute('content', 'noindex, nofollow');
    } else {
      ensureMetaByName('robots').setAttribute('content', robots);
      ensureMetaByName('googlebot').setAttribute('content', robots);
    }

    if (keywords) {
      ensureMetaByName('keywords').setAttribute('content', keywords);
    } else {
      const keywordsTag = document.head.querySelector('meta[name="keywords"]');
      if (keywordsTag) keywordsTag.remove();
    }

    ensureMetaByProperty('og:title').setAttribute('content', title);
    ensureMetaByProperty('og:description').setAttribute('content', description);
    ensureMetaByProperty('og:type').setAttribute('content', seo.type || 'website');
    ensureMetaByProperty('og:url').setAttribute('content', canonicalUrl);
    ensureMetaByProperty('og:image').setAttribute('content', image);
    ensureMetaByProperty('og:image:secure_url').setAttribute('content', image);
    ensureMetaByProperty('og:locale').setAttribute('content', 'en_US');
    ensureMetaByProperty('og:image:alt').setAttribute(
      'content',
      seo.imageAlt || 'Drizzlix interface showing AI flashcards and study analytics'
    );
    ensureMetaByProperty('og:site_name').setAttribute('content', seoGlobals.siteName);

    ensureMetaByName('twitter:card').setAttribute('content', 'summary_large_image');
    ensureMetaByName('twitter:title').setAttribute('content', title);
    ensureMetaByName('twitter:description').setAttribute('content', description);
    ensureMetaByName('twitter:image').setAttribute('content', image);
    ensureMetaByName('twitter:url').setAttribute('content', canonicalUrl);

    // INJECT SCHEMA DEFINITIONS
    upsertJsonLd(seo.schema || null);
  }, [location.pathname, isAuthenticated]);

  return null;
});

export default SEOMeta;

