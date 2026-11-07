import { CategoryTile, SectionHeader, type Category } from "../components/commerce";

export type CategoryCarouselProps = {
  title: string;
  linkLabel?: string;
  link?: string;
  categories: Category[];
};

/** A row that runs off the page edge; the clipped last tile says it scrolls. */
export function CategoryCarousel({ title, linkLabel, link, categories }: CategoryCarouselProps) {
  return (
    <section className="strata-category-carousel">
      <SectionHeader title={title} linkLabel={linkLabel} link={link} />
      <div className="strata-carousel-track">
        {categories.map((category) => (
          <CategoryTile key={category.name} category={category} />
        ))}
      </div>
    </section>
  );
}
