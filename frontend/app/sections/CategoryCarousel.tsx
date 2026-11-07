import { CategoryTile, SectionHeader, type Category } from "../components/commerce";

export type CategoryCarouselProps = {
  title: string;
  linkLabel?: string;
  link?: string;
  categories: Category[];
};

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
