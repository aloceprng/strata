"use client";

import { Avatar, BasketButton, Icon, LinkTo, NavLink, SearchField } from "../components/commerce";
import { IconButton } from "../components/primitives";
import { fill } from "../store/catalogue";
import { useStore } from "../store/StoreProvider";

type Link = { label: string; link?: string; active?: boolean };

export type SiteHeaderProps = {
  variant: "full" | "minimal";
  logo?: string;
  logoAlt?: string;
  logoPosition?: "start" | "center";
  links: Link[];
  utilities?: Link[];
  searchPlaceholder?: string;
  initials?: string;
  basket?: boolean;
};

export function SiteHeader({
  variant,
  logo,
  logoAlt = "",
  logoPosition = "start",
  links,
  utilities = [],
  searchPlaceholder,
  initials,
  basket,
}: SiteHeaderProps) {
  const store = useStore();
  const counts = { units: store?.totals.units ?? 0, lines: store?.totals.lines.length ?? 0 };
  const logoMark = logo ? (
    <LinkTo className="strata-site-logo" link="home">
      <img src={logo} alt={logoAlt} />
    </LinkTo>
  ) : null;

  return (
    <header className="strata-site-header" data-variant={variant} data-logo={logo ? logoPosition : undefined}>
      {logoPosition === "start" ? logoMark : null}
      <nav className="strata-site-nav" aria-label="Main">
        {links.map((link) => (
          <NavLink key={link.label} {...link} />
        ))}
      </nav>
      {logoPosition === "center" ? logoMark : <div className="strata-site-header-spacer" />}
      {searchPlaceholder ? <SearchField placeholder={searchPlaceholder} /> : null}
      {utilities.length ? (
        <nav className="strata-site-nav" data-utilities aria-label="Account">
          {utilities.map((link) => (
            <NavLink key={link.label} {...link} label={fill(link.label, counts)} />
          ))}
        </nav>
      ) : null}
      {variant === "full" ? (
        <>
          <IconButton variant="secondary" shape="circle" label="Saved items">
            <Icon name="heart" />
          </IconButton>
          {initials ? <Avatar initials={initials} /> : null}
          {basket ? <BasketButton /> : null}
        </>
      ) : null}
    </header>
  );
}
