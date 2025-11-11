// similar products
const similarItems = (currentItem: any, allItems: any[]) => {
  let categories: string[] = [];

  // set categories
  if (currentItem.data.categories.length > 0) {
    categories = currentItem.data.categories;
  }

  // filter by categories
  const filterByCategories = allItems.filter((item: any) =>
    categories.find((category) => item.data.categories.includes(category)),
  );

  // merged after filter
  const mergedItems = [...new Set([...filterByCategories])];

  // filter by slug
  const filterById = mergedItems.filter(
    (product) => product.id !== currentItem.id,
  );

  return filterById;
};

export default similarItems;
