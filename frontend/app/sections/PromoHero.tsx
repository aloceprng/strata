import { LinkTo } from "../components/commerce";
import { Heading, Text } from "../components/primitives";

export type PromoHeroProps = {
  eyebrow?: string;
  headline: string;
  body?: string;
  action?: string;
  link?: string;
  image: string;
  imageAlt?: string;
};

export function PromoHero({ eyebrow, headline, body, action, link, image, imageAlt = "" }: PromoHeroProps) {
  return (
    <section className="strata-promo-hero">
      <img className="strata-promo-hero-image" src={image} alt={imageAlt} />
      <div className="strata-promo-hero-copy">
        <div className="strata-promo-hero-headline">
          {eyebrow ? <span className="strata-eyebrow">{eyebrow}</span> : null}
          <Heading level={1}>{headline}</Heading>
        </div>
        {body ? <Text tone="secondary">{body}</Text> : null}
        {action ? (
          <LinkTo className="strata-button strata-promo-hero-action" data-variant="primary" data-size="md" link={link}>
            {action}
          </LinkTo>
        ) : null}
      </div>
    </section>
  );
}
