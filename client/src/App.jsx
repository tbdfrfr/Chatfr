import React, { useEffect, useMemo, useState } from 'react';
import sciencePostsRaw from './sciencePosts.json';

const SCIENCE_POSTS = Array.isArray(sciencePostsRaw)
  ? sciencePostsRaw
      .map((post, index) => ({
        _id: index,
        title: typeof post?.title === 'string' ? post.title : '',
        preview: typeof post?.preview === 'string' ? post.preview : '',
        body: typeof post?.body === 'string' ? post.body : '',
        recommendedSearchTerms: Array.isArray(post?.recommendedSearchTerms)
          ? post.recommendedSearchTerms.filter((term) => typeof term === 'string')
          : []
      }))
      .filter((post) => post.title || post.preview || post.body || post.recommendedSearchTerms.length > 0)
  : [];

export default function App() {
  useEffect(() => {
    document.title = 'Bagcat Science Ledger';
  }, []);

  return <ScienceBlog />;
}

function ScienceBlog() {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(18);
  const [activePostId, setActivePostId] = useState(null);

  const filtered = useMemo(() => {
    const normalized = sanitizeQuery(query).toLowerCase();
    if (!normalized) {
      return SCIENCE_POSTS;
    }

    return SCIENCE_POSTS.filter((post) => {
      const title = typeof post.title === 'string' ? post.title.toLowerCase() : '';
      const preview = typeof post.preview === 'string' ? post.preview.toLowerCase() : '';
      return matchesBoundaryText(title, normalized) || matchesBoundaryText(preview, normalized);
    });
  }, [query]);

  const featured = filtered[0];
  const activePost = SCIENCE_POSTS.find((post) => post._id === activePostId) || null;
  const posts = filtered.slice(1, visibleCount + 1);

  return (
    <main className="science-shell">
      <header className="science-hero">
        <div className="science-hero-inner">
          <p className="science-eyebrow">Bagcat Science Ledger</p>
          <h1>Daily Scientific Dispatches</h1>
          <p>
            A curated feed currently holding {SCIENCE_POSTS.length} science articles.
          </p>
          <label className="science-search">
            <span>Search posts</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={'Search title or preview'}
            />
          </label>
          <p className="science-count">{filtered.length} posts available</p>
        </div>
      </header>

      {featured ? (
        <article
          className="science-featured science-clickable"
          role="button"
          tabIndex={0}
          onClick={() => setActivePostId(featured._id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setActivePostId(featured._id);
            }
          }}
        >
          <h2>{featured.title}</h2>
          <p>{featured.preview}</p>
          <p className="science-read-hint">Click to read more</p>
        </article>
      ) : (
        <section className="science-featured">
          <h2>No results</h2>
          <p>Try a broader keyword.</p>
        </section>
      )}

      <section className="science-grid" aria-label="Science posts">
        {posts.map((post) => (
          <article
            key={post._id}
            className={`science-card science-clickable ${activePost?._id === post._id ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setActivePostId(post._id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActivePostId(post._id);
              }
            }}
          >
            <h3>{post.title}</h3>
            <p>{post.preview}</p>
            <p>{getBodyPreview(post)}</p>
            <p className="science-read-hint">Click to read more</p>
          </article>
        ))}
      </section>

      {visibleCount + 1 < filtered.length ? (
        <div className="science-load-more">
          <button className="primary" type="button" onClick={() => setVisibleCount((count) => count + 18)}>
            Load More Posts
          </button>
        </div>
      ) : null}

      {activePost ? (
        <div className="science-modal-overlay" role="dialog" aria-modal="true" onMouseDown={() => setActivePostId(null)}>
          <article className="science-modal-card science-detail" onMouseDown={(event) => event.stopPropagation()}>
            <div className="science-detail-head">
              <button className="ghost" type="button" onClick={() => setActivePostId(null)}>Close</button>
            </div>
            <h2>{activePost.title}</h2>
            <p>{activePost.preview}</p>
            <h3>Recommended Search Terms</h3>
            <div className="science-terms">
              {activePost.recommendedSearchTerms.map((term) => (
                <a key={term} href={`https://www.google.com/search?q=${encodeURIComponent(term)}`} target="_blank" rel="noreferrer noopener">{term}</a>
              ))}
            </div>
            <h3>Body</h3>
            {getBodyParagraphs(activePost).map((paragraph, index) => (
              <p key={`body-${index}`}>{paragraph}</p>
            ))}
          </article>
        </div>
      ) : null}
    </main>
  );
}

function sanitizeQuery(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBodyParagraphs(post) {
  const body = typeof post?.body === 'string' ? post.body : '';
  return body.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function getBodyPreview(post) {
  return getBodyParagraphs(post)[0] || '';
}

function matchesBoundaryText(text, query) {
  if (!text || !query) {
    return false;
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^a-z0-9])${escapedQuery}([^a-z0-9]|$)`, 'i');
  return pattern.test(text);
}
