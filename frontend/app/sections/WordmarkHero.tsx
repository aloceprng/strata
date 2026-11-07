import { LinkTo } from "../components/commerce";

export type WordmarkHeroProps = {
  wordmark: string;
  wordmarkAlt?: string;
  image?: string;
  imageAlt?: string;
  actions?: { label: string; variant?: "primary" | "secondary"; link?: string }[];
};

export function WordmarkHero({ wordmark, wordmarkAlt = "", image, imageAlt = "", actions = [] }: WordmarkHeroProps) {
  return (
    <section className="strata-wordmark-hero">
      {image ? <img className="strata-wordmark-hero-image" src={image} alt={imageAlt} /> : null}
      <div className="strata-wordmark-hero-lockup">
        <img className="strata-wordmark" src={wordmark} alt={wordmarkAlt} />
        {actions.length ? (
          <div className="strata-wordmark-hero-actions">
            {actions.map((action) => (
              <LinkTo
                key={action.label}
                className="strata-button"
                data-variant={action.variant ?? "primary"}
                data-size="md"
                link={action.link}
              >
                {action.label}
              </LinkTo>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
