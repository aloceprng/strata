"use client";

import { Button, Input } from "../components/primitives";

export type SiteFooterProps = {
  newsletterTitle?: string;
  newsletterBody?: string;
  columns?: { title: string; links: { label: string }[] }[];
  wordmark?: string;
  wordmarkAlt?: string;
  copyright?: string;
};

export function SiteFooter({ newsletterTitle, newsletterBody, columns = [], wordmark, wordmarkAlt = "", copyright }: SiteFooterProps) {
  return (
    <footer className="strata-site-footer">
      <div className="strata-footer-top">
        {newsletterTitle ? (
          <div className="strata-footer-newsletter">
            <h2>{newsletterTitle}</h2>
            {newsletterBody ? <p>{newsletterBody}</p> : null}
            <form onSubmit={(event) => event.preventDefault()}>
              <Input type="email" placeholder="Your email" aria-label="Your email" />
              <Button variant="primary" type="submit">
                Subscribe
              </Button>
            </form>
          </div>
        ) : null}
        <div className="strata-footer-columns">
          {columns.map((column) => (
            <div key={column.title} className="strata-footer-column">
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>{link.label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="strata-footer-mark">
        {wordmark ? (
          // masked so the wordmark takes the footer token colour
          <span
            className="strata-footer-wordmark"
            role="img"
            aria-label={wordmarkAlt}
            style={{ maskImage: `url(${wordmark})`, WebkitMaskImage: `url(${wordmark})` }}
          />
        ) : null}
        {copyright ? <small>{copyright}</small> : null}
      </div>
    </footer>
  );
}
