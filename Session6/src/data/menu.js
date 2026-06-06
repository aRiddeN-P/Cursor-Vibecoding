const categories = [
  {
    categoryId: 'iranian',
    categoryName: 'Iranian Food',
    dishes: [
      { dishCode: 'IR001', name: 'Ghormeh Sabzi', category: 'Iranian Food', orderCount: 0 },
      { dishCode: 'IR002', name: 'Fesenjan', category: 'Iranian Food', orderCount: 0 },
      { dishCode: 'IR003', name: 'Tahchin', category: 'Iranian Food', orderCount: 0 },
      { dishCode: 'IR004', name: 'Kebab Koobideh', category: 'Iranian Food', orderCount: 0 },
    ],
  },
  {
    categoryId: 'western',
    categoryName: 'Western Food',
    dishes: [
      { dishCode: 'WE001', name: 'Grilled Steak', category: 'Western Food', orderCount: 0 },
      { dishCode: 'WE002', name: 'Spaghetti Bolognese', category: 'Western Food', orderCount: 0 },
      { dishCode: 'WE003', name: 'Chicken Alfredo', category: 'Western Food', orderCount: 0 },
      { dishCode: 'WE004', name: 'Beef Burger', category: 'Western Food', orderCount: 0 },
    ],
  },
  {
    categoryId: 'salad',
    categoryName: 'Salad',
    dishes: [
      { dishCode: 'SA001', name: 'Greek Salad', category: 'Salad', orderCount: 0 },
      { dishCode: 'SA002', name: 'Caesar Salad', category: 'Salad', orderCount: 0 },
      { dishCode: 'SA003', name: 'Shirazi Salad', category: 'Salad', orderCount: 0 },
      { dishCode: 'SA004', name: 'Garden Salad', category: 'Salad', orderCount: 0 },
    ],
  },
  {
    categoryId: 'vegetarian',
    categoryName: 'Vegetarian Food',
    dishes: [
      { dishCode: 'VE001', name: 'Vegetable Stew', category: 'Vegetarian Food', orderCount: 0 },
      { dishCode: 'VE002', name: 'Mushroom Risotto', category: 'Vegetarian Food', orderCount: 0 },
      { dishCode: 'VE003', name: 'Falafel Plate', category: 'Vegetarian Food', orderCount: 0 },
      { dishCode: 'VE004', name: 'Stuffed Peppers', category: 'Vegetarian Food', orderCount: 0 },
    ],
  },
  {
    categoryId: 'fastfood',
    categoryName: 'Fast Food',
    dishes: [
      { dishCode: 'FF001', name: 'Cheeseburger', category: 'Fast Food', orderCount: 0 },
      { dishCode: 'FF002', name: 'French Fries', category: 'Fast Food', orderCount: 0 },
      { dishCode: 'FF003', name: 'Hot Dog', category: 'Fast Food', orderCount: 0 },
      { dishCode: 'FF004', name: 'Chicken Nuggets', category: 'Fast Food', orderCount: 0 },
    ],
  },
];

function findDishByCode(dishCode) {
  for (const category of categories) {
    const dish = category.dishes.find((d) => d.dishCode === dishCode);
    if (dish) return dish;
  }
  return null;
}

function getMenu() {
  return { categories };
}

module.exports = { categories, findDishByCode, getMenu };
